-- Create retro-audio bucket for user-uploaded background music (public read)
insert into storage.buckets (id, name, public)
values ('retro-audio', 'retro-audio', true)
on conflict (id) do nothing;

-- Public can read audio files
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read retro-audio'
  ) then
    create policy "Public read retro-audio"
      on storage.objects for select
      using (bucket_id = 'retro-audio');
  end if;
end $$;

-- Authenticated users can upload audio
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Auth can upload retro-audio'
  ) then
    create policy "Auth can upload retro-audio"
      on storage.objects for insert to authenticated
      with check (bucket_id = 'retro-audio');
  end if;
end $$;

-- Authenticated users can delete their own uploads (based on user id embedded in filename)
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Auth can delete own retro-audio'
  ) then
    create policy "Auth can delete own retro-audio"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'retro-audio'
        and position(auth.uid()::text in name) > 0
      );
  end if;
end $$;

-- Create tts-audio-cache bucket for Edge Function generated audio (public read)
insert into storage.buckets (id, name, public)
values ('tts-audio-cache', 'tts-audio-cache', true)
on conflict (id) do nothing;

-- Public can read cached TTS audio
do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'Public read tts-audio-cache'
  ) then
    create policy "Public read tts-audio-cache"
      on storage.objects for select
      using (bucket_id = 'tts-audio-cache');
  end if;
end $$;

-- Note: Inserts/updates for tts-audio-cache are performed by Edge Functions using SERVICE_ROLE key.
-- The service role bypasses RLS, so additional insert/update policies are not required.


