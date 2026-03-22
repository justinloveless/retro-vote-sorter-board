import { describe, it, expect } from 'vitest';
import { wikiCommonToTiptapJSON, tiptapJSONToWikiCommon } from './wikiTiptapBridge';
import { canEditDescriptionRichly } from './segmentWiki';

function roundTrip(wiki: string): string {
  return tiptapJSONToWikiCommon(wikiCommonToTiptapJSON(wiki));
}

describe('wikiTiptapBridge', () => {
  it('round-trips colored panels with bold and paragraphs', () => {
    const wiki = `{panel:bgColor=#eae6ff}
*What*

Write a high level design (HLD) for migrating Appflow.
{panel}
{panel:bgColor=#deebff}
*Why*

Azure DevOps OAuth is deprecated.
{panel}`;

    const out = roundTrip(wiki);
    expect(out).toContain('{panel:bgColor=#eae6ff}');
    expect(out).toContain('{panel:bgColor=#deebff}');
    expect(out).toContain('*What*');
    expect(out).toContain('*Why*');
    expect(out).toContain('Write a high level design');
    expect(out).toContain('Azure DevOps OAuth is deprecated');
    expect(out).toMatch(/\{panel\}/g);
    expect(out.match(/\{panel\}/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('round-trips headings and lists', () => {
    const wiki = `h1. Title here

# first item
## nested item

* bullet one
** nested bullet
`;
    const out = roundTrip(wiki);
    expect(out).toContain('h1. Title here');
    expect(out).toContain('# first item');
    expect(out).toContain('## nested item');
    expect(out).toContain('* bullet one');
    expect(out).toContain('** nested bullet');
  });

  it('round-trips noformat block', () => {
    const wiki = `{noformat}
line1
line2
{noformat}`;
    const out = roundTrip(wiki);
    expect(out).toContain('{noformat}');
    expect(out).toContain('line1');
    expect(out).toContain('line2');
  });

  it('canEditDescriptionRichly rejects color macro and images', () => {
    expect(canEditDescriptionRichly('{panel}\nhi{panel}\n')).toBe(true);
    expect(canEditDescriptionRichly('{color:red}text{color}')).toBe(false);
    expect(canEditDescriptionRichly('see !shot.png!')).toBe(false);
  });
});
