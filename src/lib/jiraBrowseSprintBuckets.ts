/** Issues with no sprint or the API placeholder label are grouped as backlog (always shown last). */
export function isJiraBrowseBacklogSprint(sprint: string | null | undefined): boolean {
  return sprint == null || sprint === '' || sprint === 'Backlog';
}

export type IssueForSprintGrouping = {
  sprint: string | null;
  sprintStartDate?: string | null;
};

/** Key + parent — used to cluster siblings within a sprint bucket. */
export type IssueForSprintBucket = IssueForSprintGrouping & {
  key: string;
  parent?: { key: string; summary?: string } | null;
};

const NO_PARENT_SORT = '\uffff\uffff_no_parent_\uffff\uffff';

/** Keeps issues with the same parent adjacent; order by parent key, then issue key. No-parent issues last. */
function sortIssuesByParentCluster<T extends IssueForSprintBucket>(issues: T[]): T[] {
  return [...issues].sort((a, b) => {
    const pa = a.parent?.key ?? NO_PARENT_SORT;
    const pb = b.parent?.key ?? NO_PARENT_SORT;
    if (pa !== pb) return pa.localeCompare(pb);
    return a.key.localeCompare(b.key);
  });
}

export function buildJiraBrowseIssuesBySprint<T extends IssueForSprintBucket>(issues: T[]): {
  backlog: T[];
  sprintBuckets: Array<{ name: string; issues: T[] }>;
} {
  const backlog: T[] = [];
  const groups = new Map<string, T[]>();
  for (const issue of issues) {
    if (isJiraBrowseBacklogSprint(issue.sprint)) {
      backlog.push(issue);
      continue;
    }
    const bucket = issue.sprint as string;
    const list = groups.get(bucket) || [];
    list.push(issue);
    groups.set(bucket, list);
  }

  const sprintBuckets = Array.from(groups.entries()).map(([name, iss]) => {
    const startDate = iss.find((i) => i.sprintStartDate)?.sprintStartDate ?? null;
    return { name, issues: iss, startDate };
  });

  sprintBuckets.sort((a, b) => {
    const aHas = a.startDate != null && a.startDate !== '';
    const bHas = b.startDate != null && b.startDate !== '';
    if (aHas && bHas) {
      const ta = new Date(a.startDate!).getTime();
      const tb = new Date(b.startDate!).getTime();
      const aOk = !Number.isNaN(ta);
      const bOk = !Number.isNaN(tb);
      if (aOk && bOk && ta !== tb) return ta - tb;
      if (aOk !== bOk) return aOk ? -1 : 1;
    } else if (aHas !== bHas) {
      return aHas ? -1 : 1;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  });

  return {
    backlog: sortIssuesByParentCluster(backlog),
    sprintBuckets: sprintBuckets.map(({ name, issues: bucketIssues }) => ({
      name,
      issues: sortIssuesByParentCluster(bucketIssues),
    })),
  };
}
