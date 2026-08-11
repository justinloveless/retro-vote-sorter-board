import { describe, expect, it } from 'vitest';
import { issueKeyFromSearchText } from './jiraIssueKeySearch';

describe('issueKeyFromSearchText', () => {
  it('parses and normalizes keys', () => {
    expect(issueKeyFromSearchText('RNMT-8100')).toBe('RNMT-8100');
    expect(issueKeyFromSearchText('  rnmt-8107  ')).toBe('RNMT-8107');
  });

  it('rejects non-keys', () => {
    expect(issueKeyFromSearchText('')).toBeNull();
    expect(issueKeyFromSearchText('8100')).toBeNull();
    expect(issueKeyFromSearchText('fix login')).toBeNull();
    expect(issueKeyFromSearchText('RNMT-8100 extra')).toBeNull();
  });
});
