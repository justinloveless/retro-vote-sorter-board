import {
  assertEquals,
  assertExists,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildStaticJiraIssueDetailFieldsParam,
  trimIssueComments,
  JIRA_ISSUE_DETAIL_MAX_COMMENTS,
} from './jiraIssueDetailFields.ts';

Deno.test('buildStaticJiraIssueDetailFieldsParam includes core drawer fields', () => {
  const fields = buildStaticJiraIssueDetailFieldsParam();
  for (const required of ['summary', 'description', 'status', 'attachment', 'issuelinks']) {
    assertEquals(fields.includes(required), true, `missing ${required}`);
  }
  assertEquals(fields.includes('comment'), false, 'comment is appended by callers');
});

Deno.test('trimIssueComments keeps newest comments and preserves total', () => {
  const comments = Array.from({ length: JIRA_ISSUE_DETAIL_MAX_COMMENTS + 5 }, (_, i) => ({
    id: String(i),
    created: new Date(Date.UTC(2024, 0, i + 1)).toISOString(),
    author: { displayName: `User ${i}` },
    body: `Comment ${i}`,
  }));

  const trimmed = trimIssueComments({
    key: 'PROJ-1',
    fields: {
      summary: 'Test',
      comment: { comments, total: comments.length, maxResults: comments.length, startAt: 0 },
    },
  });

  assertExists(trimmed.fields.comment);
  assertEquals(trimmed.fields.comment.comments.length, JIRA_ISSUE_DETAIL_MAX_COMMENTS);
  assertEquals(trimmed.fields.comment.total, comments.length);
  // Newest first after trim
  assertEquals(trimmed.fields.comment.comments[0].id, String(comments.length - 1));
});

Deno.test('trimIssueComments is a no-op under the limit', () => {
  const comments = [
    { id: '1', created: '2024-01-01T00:00:00.000Z', body: 'a' },
    { id: '2', created: '2024-01-02T00:00:00.000Z', body: 'b' },
  ];
  const input = { fields: { comment: { comments, total: 2 } } };
  const out = trimIssueComments(input);
  assertEquals(out, input);
});
