import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  hasNonEmptySearchText,
  issueKeyFromSearchText,
  shouldUseBoardRankedIssueFetch,
} from './jiraBoardIssuesSearch.ts';

Deno.test('issueKeyFromSearchText parses bare keys and normalizes project casing', () => {
  assertEquals(issueKeyFromSearchText('RNMT-8100'), 'RNMT-8100');
  assertEquals(issueKeyFromSearchText('  rnmt-8100  '), 'RNMT-8100');
  assertEquals(issueKeyFromSearchText('ABC_1-2'), 'ABC_1-2');
});

Deno.test('issueKeyFromSearchText rejects non-keys', () => {
  assertEquals(issueKeyFromSearchText(''), null);
  assertEquals(issueKeyFromSearchText('8100'), null);
  assertEquals(issueKeyFromSearchText('RNMT-'), null);
  assertEquals(issueKeyFromSearchText('fix login'), null);
  assertEquals(issueKeyFromSearchText('RNMT-8100 extra'), null);
  assertEquals(issueKeyFromSearchText(null), null);
});

Deno.test('hasNonEmptySearchText', () => {
  assertEquals(hasNonEmptySearchText('RNMT-8100'), true);
  assertEquals(hasNonEmptySearchText('  x  '), true);
  assertEquals(hasNonEmptySearchText('   '), false);
  assertEquals(hasNonEmptySearchText(undefined), false);
});

Deno.test('shouldUseBoardRankedIssueFetch is off when searching (incl. exact key)', () => {
  assertEquals(
    shouldUseBoardRankedIssueFetch({
      resolvedBoardId: 42,
      sprintScope: 'board-open-backlog',
      searchText: 'RNMT-8100',
    }),
    false,
  );
  assertEquals(
    shouldUseBoardRankedIssueFetch({
      resolvedBoardId: 42,
      sprintScope: 'board-open-backlog',
      searchText: 'login',
    }),
    false,
  );
});

Deno.test('shouldUseBoardRankedIssueFetch is on for default board browse', () => {
  assertEquals(
    shouldUseBoardRankedIssueFetch({
      resolvedBoardId: 42,
      sprintScope: 'board-open-backlog',
      searchText: undefined,
    }),
    true,
  );
  assertEquals(
    shouldUseBoardRankedIssueFetch({
      resolvedBoardId: 42,
      sprintScope: 'board-open-backlog',
      searchText: '   ',
    }),
    true,
  );
});

Deno.test('shouldUseBoardRankedIssueFetch is off without board or non-board scope', () => {
  assertEquals(
    shouldUseBoardRankedIssueFetch({
      resolvedBoardId: undefined,
      sprintScope: 'board-open-backlog',
      searchText: undefined,
    }),
    false,
  );
  assertEquals(
    shouldUseBoardRankedIssueFetch({
      resolvedBoardId: 42,
      sprintScope: 'all',
      searchText: undefined,
    }),
    false,
  );
});
