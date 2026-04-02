import type { Profile } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { combineAdvisorPrompts, type PokerAdvisorQAItem, type PokerAdvisorRequestPayload } from '@/lib/pokerLocalAdvisor';
import type { GameState } from '@/hooks/usePokerSession';
import type { PokerSessionRound } from '@/hooks/usePokerSessionHistory';

type ChatRow = {
  id: string;
  user_id: string | null;
  user_name: string;
  message: string;
  created_at: string;
  reply_to_message_id: string | null;
};

const ADVISOR_QUESTION_TAG = '__advisor_question__';

function tryParseAdvisorQuestionMessage(msg: string): { id: string; question: string } | null {
  const raw = (msg || '').trim();
  if (!raw.startsWith(ADVISOR_QUESTION_TAG)) return null;
  const rest = raw.slice(ADVISOR_QUESTION_TAG.length).trim();
  if (!rest) return null;
  try {
    const o = JSON.parse(rest) as unknown;
    if (!o || typeof o !== 'object') return null;
    const r = o as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    const question = typeof r.question === 'string' ? r.question.trim() : '';
    if (!id || !question) return null;
    return { id, question };
  } catch {
    return null;
  }
}

export function hashQa(qa: PokerAdvisorQAItem[]): string {
  // Small stable hash (djb2) to vary cache key when answers change.
  const s = JSON.stringify(
    qa.map((i) => ({
      id: i.id,
      q: i.question,
      a: (i.answer ?? '').trim(),
    })),
  );
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Scopes advisor/context/split caches to team + session + ticket (matches usePokerLocalAdvisor). */
export function buildScopedTicketKeyBase(options: {
  teamId: string | undefined;
  sessionId: string | null | undefined;
  ticketKey: string;
}): string {
  const { teamId, sessionId, ticketKey } = options;
  const tk = (ticketKey || '').trim();
  if (!tk || tk === '—') return '—';
  const tid = (teamId || '').trim();
  const sid = (sessionId || '').trim();
  if (!tid || !sid) return tk;
  return `${tid}|${sid}|${tk}`;
}

async function optionalJiraDescription(teamId: string | undefined, ticketKey: string): Promise<string | null> {
  if (!teamId || !ticketKey?.trim()) return null;
  try {
    const { data, error } = await supabase.functions.invoke('get-jira-issue', {
      body: { issueIdOrKey: ticketKey.trim(), teamId },
    });
    if (error || !data || typeof data !== 'object' || 'error' in data) return null;
    const fields = data.fields as Record<string, unknown> | undefined;
    if (!fields) return null;
    const d = fields.description;
    if (typeof d === 'string') return d.slice(0, 12000);
    if (d && typeof d === 'object') {
      return JSON.stringify(d).slice(0, 12000);
    }
    return null;
  } catch {
    return null;
  }
}

export async function fetchRoundQa(sessionId: string, roundNumber: number): Promise<PokerAdvisorQAItem[]> {
  try {
    const { data, error } = await supabase
      .from('poker_session_chat')
      .select('id,user_id,user_name,message,created_at,reply_to_message_id')
      .eq('session_id', sessionId)
      .eq('round_number', roundNumber)
      .order('created_at', { ascending: true })
      .limit(200);

    if (error || !data) return [];
    const rows = data as unknown as ChatRow[];

    const questionsByMessageId = new Map<string, { qid: string; question: string }>();
    for (const r of rows) {
      if (r.user_name !== 'Advisor') continue;
      const q = tryParseAdvisorQuestionMessage(r.message);
      if (!q) continue;
      questionsByMessageId.set(r.id, { qid: q.id, question: q.question });
    }

    // Latest answer per question id.
    const answersByQid = new Map<string, string>();
    for (const r of rows) {
      const parentId = r.reply_to_message_id;
      if (!parentId) continue;
      const q = questionsByMessageId.get(parentId);
      if (!q) continue;
      if (!r.user_id) continue;
      const a = (r.message || '').trim();
      if (!a) continue;
      answersByQid.set(q.qid, a);
    }

    const out: PokerAdvisorQAItem[] = [];
    for (const [, q] of questionsByMessageId) {
      out.push({ id: q.qid, question: q.question, answer: answersByQid.get(q.qid) });
    }
    return out;
  } catch {
    return [];
  }
}

async function fetchTeamPrompt(teamId: string | undefined): Promise<string | null> {
  if (!teamId) return null;
  const { data } = await supabase.from('teams').select('poker_advisor_team_prompt').eq('id', teamId).maybeSingle();
  const raw = data?.poker_advisor_team_prompt;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export async function buildPokerAdvisorRequestPayload(options: {
  round: PokerSessionRound;
  gameState: GameState;
  profile: Profile | null;
  teamId: string | undefined;
  sessionId: string | null;
  qa: PokerAdvisorQAItem[];
  includeQa?: boolean;
}): Promise<PokerAdvisorRequestPayload> {
  const { round, gameState, profile, teamId, sessionId, qa, includeQa = true } = options;
  const tk = (round.ticket_number || '').trim();
  const rid = round.id;
  const rnum = round.round_number;

  let description: string | null = null;
  if (teamId && tk && tk !== '—') {
    description = await optionalJiraDescription(teamId, tk);
  }

  const teamPrompt = await fetchTeamPrompt(teamId);
  const personalRaw = profile?.poker_advisor_personal_prompt;
  const personalPrompt = typeof personalRaw === 'string' && personalRaw.trim() ? personalRaw.trim() : null;

  return {
    roundId: rid,
    ticketKey: tk,
    ticketTitle: round.ticket_title ?? null,
    parentKey: round.ticket_parent_key ?? null,
    parentSummary: round.ticket_parent_summary ?? null,
    description,
    roundNumber: rnum,
    gameState,
    teamPrompt,
    personalPrompt,
    combinedPrompt: combineAdvisorPrompts(teamPrompt, personalPrompt),
    qa: includeQa ? (sessionId ? qa : qa) : [],
  };
}

