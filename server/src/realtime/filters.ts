/**
 * Match Supabase-style realtime filters: `col=eq.value` or `col=in.(a,b,c)`.
 */

export interface PostgresChangeEvent {
  schema: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

export interface PostgresChangeBinding {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema: string;
  table: string;
  filter?: string;
}

function normalizeValue(raw: string): string {
  return raw.trim();
}

function rowValueEquals(row: Record<string, unknown>, column: string, expected: string): boolean {
  if (!(column in row)) return false;
  const actual = row[column];
  if (actual === null || actual === undefined) {
    return expected === 'null';
  }
  return String(actual) === expected;
}

/** Evaluate a single `col=eq.x` / `col=in.(...)` clause against a row. */
export function matchFilterClause(row: Record<string, unknown> | null, filter?: string): boolean {
  if (!filter) return true;
  if (!row) return false;

  const eqMatch = /^([^=]+)=eq\.(.+)$/.exec(filter);
  if (eqMatch) {
    const [, column, value] = eqMatch;
    return rowValueEquals(row, column.trim(), normalizeValue(value));
  }

  const inMatch = /^([^=]+)=in\.\((.+)\)$/.exec(filter);
  if (inMatch) {
    const [, column, list] = inMatch;
    const values = list.split(',').map((v) => normalizeValue(v.replace(/^"|"$/g, '')));
    if (!(column.trim() in row)) return false;
    const actual = row[column.trim()];
    if (actual === null || actual === undefined) return values.includes('null');
    return values.includes(String(actual));
  }

  // Unknown filter shape — fail closed so we do not leak rows.
  return false;
}

export function matchPostgresBinding(
  binding: PostgresChangeBinding,
  change: PostgresChangeEvent
): boolean {
  if (binding.schema !== change.schema) return false;
  if (binding.table !== change.table) return false;
  if (binding.event !== '*' && binding.event !== change.eventType) return false;

  const filterRow =
    change.eventType === 'DELETE'
      ? change.old
      : change.new ?? change.old;

  return matchFilterClause(filterRow, binding.filter);
}
