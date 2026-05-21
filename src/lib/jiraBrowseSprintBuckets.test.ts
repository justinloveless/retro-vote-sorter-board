import { describe, it, expect } from 'vitest';
import { buildJiraBrowseIssuesBySprint } from './jiraBrowseSprintBuckets';

type Row = {
  key: string;
  sprint: string | null;
  sprintStartDate?: string | null;
};

describe('buildJiraBrowseIssuesBySprint', () => {
  it('preserves input order inside each sprint bucket (Jira rank), not alphabetical by key', () => {
    const issues: Row[] = [
      { key: 'ENG-999', sprint: 'Sprint 42', sprintStartDate: '2025-01-01T00:00:00.000Z' },
      { key: 'ENG-100', sprint: 'Sprint 42', sprintStartDate: '2025-01-01T00:00:00.000Z' },
      { key: 'ENG-502', sprint: 'Sprint 42', sprintStartDate: '2025-01-01T00:00:00.000Z' },
    ];
    const { sprintBuckets } = buildJiraBrowseIssuesBySprint(issues);
    expect(sprintBuckets).toHaveLength(1);
    expect(sprintBuckets[0].issues.map((i) => i.key)).toEqual(['ENG-999', 'ENG-100', 'ENG-502']);
  });

  it('preserves backlog order from input traversal', () => {
    const issues: Row[] = [
      { key: 'B-3', sprint: null },
      { key: 'B-1', sprint: 'Backlog' },
      { key: 'B-9', sprint: '' },
    ];
    const { backlog } = buildJiraBrowseIssuesBySprint(issues);
    expect(backlog.map((i) => i.key)).toEqual(['B-3', 'B-1', 'B-9']);
  });

  it('preserves intra-sprint order when issues arrive interleaved across sprints', () => {
    const issues: Row[] = [
      { key: 'A-1', sprint: 'Alpha', sprintStartDate: '2025-06-01T00:00:00.000Z' },
      { key: 'B-1', sprint: 'Beta', sprintStartDate: '2025-06-15T00:00:00.000Z' },
      { key: 'A-2', sprint: 'Alpha', sprintStartDate: '2025-06-01T00:00:00.000Z' },
      { key: 'B-2', sprint: 'Beta', sprintStartDate: '2025-06-15T00:00:00.000Z' },
    ];
    const { sprintBuckets } = buildJiraBrowseIssuesBySprint(issues);
    const alpha = sprintBuckets.find((b) => b.name === 'Alpha');
    const beta = sprintBuckets.find((b) => b.name === 'Beta');
    expect(alpha?.issues.map((i) => i.key)).toEqual(['A-1', 'A-2']);
    expect(beta?.issues.map((i) => i.key)).toEqual(['B-1', 'B-2']);
  });

  it('orders sprint buckets by startDate ascending, then by name when dates tie or missing', () => {
    const issues: Row[] = [
      { key: 'Z-1', sprint: 'Zebra Later', sprintStartDate: '2026-12-31T00:00:00.000Z' },
      { key: 'E-1', sprint: 'Early Spring', sprintStartDate: '2024-01-01T00:00:00.000Z' },
      { key: 'X-1', sprint: 'X No Date Yet' },
      { key: 'Y-2', sprint: 'Y Also No Date' },
      { key: 'M-1', sprint: 'Mid', sprintStartDate: '2025-06-01T00:00:00.000Z' },
    ];
    const { sprintBuckets } = buildJiraBrowseIssuesBySprint(issues);
    expect(sprintBuckets.map((b) => b.name)).toEqual([
      'Early Spring',
      'Mid',
      'Zebra Later',
      'X No Date Yet',
      'Y Also No Date',
    ]);
    // Stable issue order inside each bucket
    expect(sprintBuckets.find((b) => b.name === 'Early Spring')?.issues.map((i) => i.key)).toEqual(['E-1']);
  });
});
