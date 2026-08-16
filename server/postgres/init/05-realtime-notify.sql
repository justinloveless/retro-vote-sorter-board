-- Phase 5 (DUN-80): Postgres NOTIFY for self-hosted realtime.
-- Node API LISTENs on channel retroscope_changes and fans out via Socket.IO.
--
-- Coolify compose embeds this via configs.content — keep compose in sync.
-- SQL must stay free of dollar signs (Compose interpolates them).

CREATE OR REPLACE FUNCTION public.retroscope_notify_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS '
DECLARE
  payload json;
  row_new json;
  row_old json;
  rooms text[] := ARRAY[]::text[];
  board_id_text text;
  team_id_text text;
  item_id_text text;
  session_id_text text;
  user_id_text text;
  op text := TG_OP;
BEGIN
  IF TG_OP = ''DELETE'' THEN
    row_old := row_to_json(OLD);
    row_new := NULL;
  ELSIF TG_OP = ''INSERT'' THEN
    row_new := row_to_json(NEW);
    row_old := NULL;
  ELSE
    row_new := row_to_json(NEW);
    row_old := row_to_json(OLD);
  END IF;

  IF TG_TABLE_NAME IN (''retro_items'', ''retro_votes'', ''retro_board_config'', ''endorsements'') THEN
    board_id_text := COALESCE(row_new ->> ''board_id'', row_old ->> ''board_id'');
    IF board_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''board:'' || board_id_text);
    END IF;
  ELSIF TG_TABLE_NAME = ''retro_boards'' THEN
    board_id_text := COALESCE(row_new ->> ''id'', row_old ->> ''id'');
    team_id_text := COALESCE(row_new ->> ''team_id'', row_old ->> ''team_id'');
    IF board_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''board:'' || board_id_text);
    END IF;
    IF team_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''team:'' || team_id_text);
    END IF;
  ELSIF TG_TABLE_NAME = ''retro_comments'' THEN
    item_id_text := COALESCE(row_new ->> ''item_id'', row_old ->> ''item_id'');
    IF item_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''item:'' || item_id_text);
      SELECT ri.board_id::text INTO board_id_text FROM public.retro_items ri WHERE ri.id::text = item_id_text LIMIT 1;
      IF board_id_text IS NOT NULL THEN
        rooms := array_append(rooms, ''board:'' || board_id_text);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = ''poker_sessions'' THEN
    session_id_text := COALESCE(row_new ->> ''id'', row_old ->> ''id'');
    team_id_text := COALESCE(row_new ->> ''team_id'', row_old ->> ''team_id'');
    IF session_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''poker:'' || session_id_text);
    END IF;
    IF team_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''team:'' || team_id_text);
    END IF;
  ELSIF TG_TABLE_NAME IN (''poker_session_rounds'', ''poker_session_chat'', ''poker_session_chat_message_reactions'') THEN
    session_id_text := COALESCE(row_new ->> ''session_id'', row_old ->> ''session_id'');
    IF session_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''poker:'' || session_id_text);
      SELECT ps.team_id::text INTO team_id_text FROM public.poker_sessions ps WHERE ps.id::text = session_id_text LIMIT 1;
      IF team_id_text IS NOT NULL THEN
        rooms := array_append(rooms, ''team:'' || team_id_text);
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = ''team_action_items'' THEN
    team_id_text := COALESCE(row_new ->> ''team_id'', row_old ->> ''team_id'');
    IF team_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''team:'' || team_id_text);
    END IF;
  ELSIF TG_TABLE_NAME = ''notifications'' THEN
    user_id_text := COALESCE(row_new ->> ''user_id'', row_old ->> ''user_id'');
    IF user_id_text IS NOT NULL THEN
      rooms := array_append(rooms, ''user:'' || user_id_text);
    END IF;
  ELSIF TG_TABLE_NAME IN (''feature_flags'', ''feature_flag_user_overrides'', ''feature_flag_team_overrides'') THEN
    rooms := array_append(rooms, ''feature-flags'');
  END IF;

  payload := json_build_object(
    ''schema'', TG_TABLE_SCHEMA,
    ''table'', TG_TABLE_NAME,
    ''event'', op,
    ''new'', row_new,
    ''old'', row_old,
    ''rooms'', to_json(rooms)
  );

  PERFORM pg_notify(''retroscope_changes'', payload::text);

  IF TG_OP = ''DELETE'' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
';

-- Attach triggers only when the table exists (schema may be restored later).
SELECT format(
  'DROP TRIGGER IF EXISTS retroscope_notify_%s ON public.%I; CREATE TRIGGER retroscope_notify_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.retroscope_notify_change();',
  replace(tablename, '_', ''),
  tablename,
  replace(tablename, '_', ''),
  tablename
)
FROM (VALUES
  ('retro_items'),
  ('retro_votes'),
  ('retro_comments'),
  ('retro_boards'),
  ('retro_board_config'),
  ('team_action_items'),
  ('poker_sessions'),
  ('poker_session_rounds'),
  ('poker_session_chat'),
  ('poker_session_chat_message_reactions'),
  ('notifications'),
  ('feature_flags'),
  ('feature_flag_user_overrides'),
  ('feature_flag_team_overrides'),
  ('endorsements')
) AS t(tablename)
WHERE EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = t.tablename
)
\gexec
