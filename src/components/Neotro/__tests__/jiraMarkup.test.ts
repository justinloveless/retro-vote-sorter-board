import { describe, it, expect } from 'vitest';

// Extract the regex logic for testing
function splitBlocks(text: string): { type: 'text' | 'panel' | 'code'; content: string; attrs?: string }[] {
  const blockRegex = /\{panel(?::([^}]*))?\}([\s\S]*?)\{panel\}|\{noformat(?::([^}]*))?\}([\s\S]*?)\{noformat\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const segments: { type: 'text' | 'panel' | 'code'; content: string; attrs?: string }[] = [];

  while ((match = blockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    if (match[4] !== undefined) {
      segments.push({ type: 'code', content: match[4], attrs: match[3] || '' });
    } else if (match[2] !== undefined) {
      segments.push({ type: 'panel', content: match[2], attrs: match[1] || '' });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }
  return segments;
}

function parseInlineTokens(text: string): { type: string; content: string }[] {
  let cleaned = text.replace(/\{color:[^}]*\}/g, '').replace(/\{color\}/g, '');
  const tokenRegex = /\{\{((?:(?!\}\}).)+)\}\}|\*([^*]+)\*|_([^_]+)_|\[([^|]*)\|([^\]]*)\]|!([^|!]+)(?:\|([^!]*))?\!/g;
  const tokens: { type: string; content: string }[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRegex.exec(cleaned)) !== null) {
    if (m.index > lastIdx) {
      tokens.push({ type: 'text', content: cleaned.slice(lastIdx, m.index) });
    }
    if (m[1] !== undefined) tokens.push({ type: 'code', content: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: 'bold', content: m[2] });
    else if (m[3] !== undefined) tokens.push({ type: 'italic', content: m[3] });
    else if (m[4] !== undefined) tokens.push({ type: 'link', content: `${m[4]}|${m[5]}` });
    else if (m[6] !== undefined) tokens.push({ type: 'image', content: m[6] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < cleaned.length) {
    tokens.push({ type: 'text', content: cleaned.slice(lastIdx) });
  }
  return tokens;
}

describe('Jira wiki markup block splitting', () => {
  it('should parse {noformat} blocks with JSON content containing braces', () => {
    const input = `{noformat}{\n"certificate": {\n"value": "string"\n}\n}{noformat}`;
    const result = splitBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('code');
    expect(result[0].content).toContain('"certificate"');
  });

  it('should parse {noformat} with surrounding text', () => {
    const input = `Some text before\n{noformat}code here{noformat}\nSome text after`;
    const result = splitBlocks(input);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('code');
    expect(result[1].content).toBe('code here');
    expect(result[2].type).toBe('text');
  });

  it('should parse {panel} blocks', () => {
    const input = `{panel:bgColor=#fffae6}Warning content{panel}`;
    const result = splitBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('panel');
    expect(result[0].attrs).toBe('bgColor=#fffae6');
  });

  it('should handle the full noformat JSON example', () => {
    const input = `{noformat}{\n\n"certificate": {\n\n"value": "string"\n\n},\n\n"certificateName": {\n\n"value": "string"\n\n}\n\n}{noformat}`;
    const result = splitBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('code');
    expect(result[0].content).toContain('"certificate"');
    expect(result[0].content).toContain('"certificateName"');
  });
});

describe('Jira inline token parsing', () => {
  it('should parse {{inline code}} with braces inside', () => {
    const input = '{{/path/{envKey}/apps/{appKey}/config}}';
    const tokens = parseInlineTokens(input);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('code');
    expect(tokens[0].content).toBe('/path/{envKey}/apps/{appKey}/config');
  });

  it('should parse *bold* text', () => {
    const tokens = parseInlineTokens('hello *world* foo');
    expect(tokens).toHaveLength(3);
    expect(tokens[1].type).toBe('bold');
    expect(tokens[1].content).toBe('world');
  });

  it('should parse _italic_ text', () => {
    const tokens = parseInlineTokens('hello _world_ foo');
    expect(tokens).toHaveLength(3);
    expect(tokens[1].type).toBe('italic');
    expect(tokens[1].content).toBe('world');
  });

  it('should parse [text|url] links', () => {
    const tokens = parseInlineTokens('click [here|https://example.com] now');
    expect(tokens).toHaveLength(3);
    expect(tokens[1].type).toBe('link');
    expect(tokens[1].content).toBe('here|https://example.com');
  });

  it('should parse mixed inline formatting', () => {
    const tokens = parseInlineTokens('*bold* and _italic_ and {{code}}');
    expect(tokens.filter(t => t.type === 'bold')).toHaveLength(1);
    expect(tokens.filter(t => t.type === 'italic')).toHaveLength(1);
    expect(tokens.filter(t => t.type === 'code')).toHaveLength(1);
  });
});
