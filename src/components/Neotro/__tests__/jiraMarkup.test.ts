import { describe, it, expect } from 'vitest';

// Manual block splitter matching the component implementation
function splitBlocks(text: string): { type: 'text' | 'panel' | 'code'; content: string; attrs?: string }[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const segments: { type: 'text' | 'panel' | 'code'; content: string; attrs?: string }[] = [];
  let remaining = normalized;

  while (remaining.length > 0) {
    const noformatIdx = remaining.indexOf('{noformat}');
    const noformatWithAttrMatch = remaining.match(/\{noformat:([^}]*)\}/);
    const noformatStart = noformatWithAttrMatch 
      ? Math.min(noformatIdx >= 0 ? noformatIdx : Infinity, remaining.indexOf(noformatWithAttrMatch[0]))
      : (noformatIdx >= 0 ? noformatIdx : Infinity);
    
    const panelMatch = remaining.match(/\{panel(?::([^}]*))?\}/);
    const panelStart = panelMatch ? remaining.indexOf(panelMatch[0]) : Infinity;

    const nextBlock = Math.min(noformatStart, panelStart);

    if (nextBlock === Infinity) {
      segments.push({ type: 'text', content: remaining });
      break;
    }

    if (nextBlock > 0) {
      segments.push({ type: 'text', content: remaining.slice(0, nextBlock) });
    }

    if (noformatStart <= panelStart) {
      const openTag = remaining.slice(noformatStart).match(/^\{noformat(?::([^}]*))?\}/);
      if (!openTag) { segments.push({ type: 'text', content: remaining }); break; }
      const attrs = openTag[1] || '';
      const afterOpen = noformatStart + openTag[0].length;
      const closeIdx = remaining.indexOf('{noformat}', afterOpen);
      if (closeIdx === -1) {
        segments.push({ type: 'text', content: remaining.slice(noformatStart) });
        break;
      }
      segments.push({ type: 'code', content: remaining.slice(afterOpen, closeIdx), attrs });
      remaining = remaining.slice(closeIdx + '{noformat}'.length);
    } else {
      const openTag = remaining.slice(panelStart).match(/^\{panel(?::([^}]*))?\}/);
      if (!openTag) { segments.push({ type: 'text', content: remaining }); break; }
      const attrs = openTag[1] || '';
      const afterOpen = panelStart + openTag[0].length;
      const closeIdx = remaining.indexOf('{panel}', afterOpen);
      if (closeIdx === -1) {
        segments.push({ type: 'text', content: remaining.slice(panelStart) });
        break;
      }
      segments.push({ type: 'panel', content: remaining.slice(afterOpen, closeIdx), attrs });
      remaining = remaining.slice(closeIdx + '{panel}'.length);
    }
  }
  return segments;
}

function parseInlineTokens(text: string): { type: string; content: string }[] {
  let cleaned = text.replace(/\{color:[^}]*\}/g, '').replace(/\{color\}/g, '');
  const tokenRegex = /\{\{((?:(?!\}\}).)+)\}\}|\*([^*]+)\*|(?<![a-zA-Z0-9])_([^_]+)_(?![a-zA-Z0-9])|\[([^[\]]*)\|([^\]]*)\]|!([^|!]+)(?:\|([^!]*))?\!/g;
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
    const input = '{noformat}{\n"certificate": {\n"value": "string"\n}\n}{noformat}';
    const result = splitBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('code');
    expect(result[0].content).toContain('"certificate"');
  });

  it('should parse {noformat} with surrounding text', () => {
    const input = 'Some text before\n{noformat}code here{noformat}\nSome text after';
    const result = splitBlocks(input);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('text');
    expect(result[1].type).toBe('code');
    expect(result[1].content).toBe('code here');
    expect(result[2].type).toBe('text');
  });

  it('should parse {panel} blocks', () => {
    const input = '{panel:bgColor=#fffae6}Warning content{panel}';
    const result = splitBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('panel');
    expect(result[0].attrs).toBe('bgColor=#fffae6');
  });

  it('should handle the full noformat JSON example with double-spaced lines', () => {
    const input = '{noformat}{\n\n"certificate": {\n\n"value": "string"\n\n},\n\n"certificateName": {\n\n"value": "string"\n\n}\n\n}{noformat}';
    const result = splitBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('code');
    expect(result[0].content).toContain('"certificate"');
    expect(result[0].content).toContain('"certificateName"');
  });

  it('should handle {noformat} immediately followed by { (no space)', () => {
    const json = '{\n"key": "value"\n}';
    const input = `{noformat}${json}{noformat}`;
    const result = splitBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('code');
    expect(result[0].content).toBe(json);
  });

  it('should handle \\r\\n line endings in noformat', () => {
    const input = '{noformat}{\r\n"key": "value"\r\n}{noformat}';
    const result = splitBlocks(input);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('code');
    expect(result[0].content).toContain('"key"');
  });

  it('should handle mixed panel and noformat blocks', () => {
    const input = '{panel:bgColor=#fff}warning{panel}\nsome text\n{noformat}code{noformat}';
    const result = splitBlocks(input);
    expect(result).toHaveLength(3);
    expect(result[0].type).toBe('panel');
    expect(result[1].type).toBe('text');
    expect(result[2].type).toBe('code');
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

  it('should not parse underscores inside words as italic', () => {
    const tokens = parseInlineTokens('some_variable_name');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('text');
  });

  it('should parse [text|url] links', () => {
    const tokens = parseInlineTokens('click [here|https://example.com] now');
    expect(tokens).toHaveLength(3);
    expect(tokens[1].type).toBe('link');
    expect(tokens[1].content).toBe('here|https://example.com');
  });

  it('should parse [*bold text*|url] links with formatting', () => {
    const tokens = parseInlineTokens('[*Click me*|https://example.com]');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('link');
    expect(tokens[0].content).toBe('*Click me*|https://example.com');
  });

  it('should parse mixed inline formatting', () => {
    const tokens = parseInlineTokens('*bold* and _italic_ and {{code}}');
    expect(tokens.filter(t => t.type === 'bold')).toHaveLength(1);
    expect(tokens.filter(t => t.type === 'italic')).toHaveLength(1);
    expect(tokens.filter(t => t.type === 'code')).toHaveLength(1);
  });

  it('should parse long inline code with slashes and braces', () => {
    const input = '{{/native-mobile-builds/v1/environments/{environmentKey}/applications/{applicationKey}/configurations/ios}}';
    const tokens = parseInlineTokens(input);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe('code');
    expect(tokens[0].content).toContain('{environmentKey}');
    expect(tokens[0].content).toContain('{applicationKey}');
  });
});
