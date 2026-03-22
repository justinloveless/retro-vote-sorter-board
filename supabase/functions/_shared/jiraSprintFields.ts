/** Sprint field parsing — same rules as Browse Jira sprint buckets. */

export type JiraSprintMeta = {
  name: string | null;
  startDate: string | null;
  /** Jira sprint id when resolved from the sprint field (may be null for string-only values). */
  sprintId: number | null;
};

export function createGetSprintMeta(
  sprintIdToName: Map<number | string, string>,
  sprintIdToStartDate: Map<number | string, string>,
): (fields: Record<string, unknown> | null | undefined) => JiraSprintMeta {
  return (fields: Record<string, unknown> | null | undefined): JiraSprintMeta => {
    const extract = (val: unknown, allowClosed: boolean): { name: string; startDate: string | null; sprintId: number | null } | null => {
      if (val == null) return null;
      const arr = Array.isArray(val) ? val : [val];
      for (let i = arr.length - 1; i >= 0; i--) {
        const item = arr[i];
        if (!item) continue;
        if (typeof item === 'object' && item !== null) {
          const o = item as Record<string, unknown>;
          const state = typeof o.state === 'string' ? o.state : null;
          if (!allowClosed && state === 'closed') continue;
          let name: string | null = null;
          if (o.name != null) name = String(o.name);
          let id: number | null = null;
          if (o.id != null) {
            const raw = typeof o.id === 'number' ? o.id : parseInt(String(o.id), 10);
            id = !isNaN(raw) ? raw : null;
          }
          if (!name && id != null && sprintIdToName.has(id)) name = sprintIdToName.get(id)!;
          let startDate: string | null = null;
          if (typeof o.startDate === 'string' && o.startDate) startDate = o.startDate;
          else if (id != null && sprintIdToStartDate.has(id)) startDate = sprintIdToStartDate.get(id)!;
          if (name) return { name, startDate, sprintId: id };
        }
        if (typeof item === 'string') {
          const stateMatch = item.match(/state=([^,\]]+)/);
          if (!allowClosed && stateMatch && stateMatch[1].trim().toLowerCase() === 'closed') continue;
          const nameMatch = item.match(/name=([^,\]]+)/);
          if (nameMatch) return { name: nameMatch[1].trim(), startDate: null, sprintId: null };
          const idMatch = item.match(/id=(\d+)/);
          if (idMatch) {
            const id = parseInt(idMatch[1], 10);
            if (sprintIdToName.has(id)) {
              const sd = sprintIdToStartDate.has(id) ? sprintIdToStartDate.get(id)! : null;
              return { name: sprintIdToName.get(id)!, startDate: sd, sprintId: id };
            }
          }
        }
      }
      return null;
    };

    for (const allowClosed of [false, true]) {
      for (const [key, value] of Object.entries(fields || {})) {
        if (value == null) continue;
        if (!key.startsWith('customfield_') && key !== 'sprint') continue;
        const meta = extract(value, allowClosed);
        if (meta) {
          return { name: meta.name, startDate: meta.startDate, sprintId: meta.sprintId };
        }
      }
    }
    return { name: null, startDate: null, sprintId: null };
  };
}
