/** Stored on `poker_session_rounds.ticket_number` when no Jira key is set — never null/empty. */
export function roundTicketPlaceholder(roundNumber: number): string {
  return `round:${roundNumber}`;
}

export function isSyntheticRoundTicket(ticket: string | null | undefined): boolean {
  if (ticket == null) return true;
  const t = String(ticket).trim();
  if (t === '') return true;
  return /^round:\d+$/i.test(t);
}

/** Chip / header label — `round:N` placeholders render as "Round N"; legacy empty as "No ticket". */
export function displayTicketLabel(ticket: string | null | undefined): string {
  const t = String(ticket ?? '').trim();
  if (t === '') return 'No ticket';
  const m = t.match(/^round:(\d+)$/i);
  if (m) return `Round ${m[1]}`;
  return t || 'No ticket';
}
