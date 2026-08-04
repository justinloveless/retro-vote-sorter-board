import { describe, it, expect } from 'vitest';
import {
  convertMarkdownLinksToHtml,
  decodeHtmlEntities,
  escapeHtml,
  parseSingleMarkdownLink,
  plainTextContainsMarkdownLink,
  plainTextWithMarkdownLinksToHtml,
} from './richTextDisplay';

describe('escapeHtml', () => {
  it('escapes HTML special characters', () => {
    expect(escapeHtml(`<script>"x"&'y'</script>`)).toBe(
      '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;'
    );
  });
});

describe('decodeHtmlEntities', () => {
  it('decodes common entities without corrupting sequences', () => {
    expect(decodeHtmlEntities('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"');
    expect(decodeHtmlEntities('&amp;lt;')).toBe('&lt;');
  });
});

describe('parseSingleMarkdownLink', () => {
  it('parses a full-string markdown link', () => {
    expect(parseSingleMarkdownLink('[Sprint Report](https://example.com/path?x=1)')).toEqual({
      label: 'Sprint Report',
      href: 'https://example.com/path?x=1',
    });
  });

  it('rejects non-http schemes and partial matches', () => {
    expect(parseSingleMarkdownLink('[x](javascript:alert(1))')).toBeNull();
    expect(parseSingleMarkdownLink('see [x](https://example.com) please')).toBeNull();
  });
});

describe('convertMarkdownLinksToHtml', () => {
  it('converts markdown links inside HTML text nodes', () => {
    const input =
      '<p>Sprint Report: [Board](https://outsystemsrd.atlassian.net/jira/software/c/projects/RNMT/retrospective?sprint=30031)</p>';
    const output = convertMarkdownLinksToHtml(input);
    expect(output).toContain(
      '<a href="https://outsystemsrd.atlassian.net/jira/software/c/projects/RNMT/retrospective?sprint=30031"'
    );
    expect(output).toContain('>Board</a>');
    expect(output).toContain('target="_blank"');
    expect(output).toContain('rel="noopener noreferrer nofollow"');
    expect(output).not.toContain('[Board]');
  });

  it('does not double-encode entities already present in TipTap HTML', () => {
    const input = '<p>[click &amp; me](https://example.com?a=1&amp;b=2)</p>';
    const output = convertMarkdownLinksToHtml(input);
    expect(output).toContain('>click &amp; me</a>');
    expect(output).toContain('href="https://example.com?a=1&amp;b=2"');
    expect(output).not.toContain('&amp;amp;');
  });

  it('neutralizes quote breakouts in URLs', () => {
    const input = '<p>[x](https://example.com/"onclick="evil)</p>';
    const output = convertMarkdownLinksToHtml(input);
    expect(output).toContain('href="https://example.com/&quot;onclick=&quot;evil"');
    expect(output).not.toMatch(/\sonclick=/i);
  });

  it('does not rewrite existing anchor tags', () => {
    const input = '<a href="https://example.com">plain</a>';
    expect(convertMarkdownLinksToHtml(input)).toBe(input);
  });

  it('leaves bare long URLs unchanged (wrapping is CSS)', () => {
    const url =
      'https://outsystemsrd.atlassian.net/jira/software/c/projects/RNMT/retrospective?sprint=30031';
    const input = `<p><a href="${url}">${url}</a></p>`;
    expect(convertMarkdownLinksToHtml(input)).toBe(input);
  });
});

describe('plainTextWithMarkdownLinksToHtml', () => {
  it('returns empty when no markdown links are present', () => {
    expect(plainTextWithMarkdownLinksToHtml('just text https://example.com')).toBe('');
  });

  it('converts inline markdown links and escapes surrounding text', () => {
    const html = plainTextWithMarkdownLinksToHtml('See [Docs](https://example.com) <script>');
    expect(html).toContain('<a href="https://example.com"');
    expect(html).toContain('>Docs</a>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('plainTextContainsMarkdownLink', () => {
  it('detects markdown links', () => {
    expect(plainTextContainsMarkdownLink('[x](https://a.com)')).toBe(true);
    expect(plainTextContainsMarkdownLink('https://a.com')).toBe(false);
  });
});
