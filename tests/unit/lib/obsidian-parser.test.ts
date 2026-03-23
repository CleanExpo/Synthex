import { parseObsidianNote } from '../../../lib/markdown/obsidian-parser';

describe('parseObsidianNote', () => {
  it('empty string returns all defaults', () => {
    const result = parseObsidianNote('');
    expect(result.title).toBe('Untitled');
    expect(result.platform).toBe('general');
    expect(result.hashtags).toEqual([]);
    expect(result.content).toBe('');
  });

  it('YAML front matter with title, platform, tone, hashtags populates all fields', () => {
    const md = `---
title: My Post
platform: linkedin
tone: professional
hashtags:
  - marketing
  - growth
---
Body content here.`;
    const result = parseObsidianNote(md);
    expect(result.title).toBe('My Post');
    expect(result.platform).toBe('linkedin');
    expect(result.tone).toBe('professional');
    expect(result.hashtags).toEqual(['marketing', 'growth']);
    expect(result.content).toContain('Body content here.');
  });

  it('WikiLink [[note name]] is stripped to plain text in content', () => {
    const md = 'Check out [[note name]] for more.';
    const result = parseObsidianNote(md);
    expect(result.content).toContain('note name');
    expect(result.content).not.toContain('[[');
  });

  it('WikiLink with alias [[note|alias]] resolves to alias in content', () => {
    const md = 'See [[project-x|Project X]] for details.';
    const result = parseObsidianNote(md);
    expect(result.content).toContain('Project X');
    expect(result.content).not.toContain('[[');
    expect(result.content).not.toContain('project-x');
  });

  it('H1 heading is used as title fallback when no front matter title', () => {
    const md = `# My Heading

Some body text.`;
    const result = parseObsidianNote(md);
    expect(result.title).toBe('My Heading');
  });

  it("'Untitled' fallback when no front matter title and no H1", () => {
    const md = 'Just some body text with no heading.';
    const result = parseObsidianNote(md);
    expect(result.title).toBe('Untitled');
  });

  it('platform comma-split uses only the first value', () => {
    const md = `---
platform: 'linkedin, twitter'
---
Body.`;
    const result = parseObsidianNote(md);
    expect(result.platform).toBe('linkedin');
  });

  it('inline hashtags are extracted from body when no front matter hashtags', () => {
    const md = 'Post body with #marketing and #growth tags.';
    const result = parseObsidianNote(md);
    expect(result.hashtags).toContain('marketing');
    expect(result.hashtags).toContain('growth');
  });

  it('H1 with WikiLink produces a stripped title', () => {
    const md = `# [[Project Name|Title]]

Body content.`;
    const result = parseObsidianNote(md);
    expect(result.title).toBe('Title');
    expect(result.title).not.toContain('[[');
    expect(result.title).not.toContain('Project Name');
  });
});
