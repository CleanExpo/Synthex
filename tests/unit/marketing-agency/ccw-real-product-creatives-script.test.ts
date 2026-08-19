import * as fs from 'node:fs';
import * as path from 'node:path';

describe('CCW real product creative generator', () => {
  const scriptPath = path.join(
    process.cwd(),
    // Archived 2026-07-12 (Real Images Only mandate, spec Part C exception #3) —
    // found by the no-direct-image-apis guard after the initial sweep missed it.
    '.claude/archived/2026-07-12/ungrounded-scripts/generate-ccw-real-product-creatives.ts'
  );

  it('uses the current GPT Image 2 model for OpenAI backgrounds', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain("const openAiImageModel = 'gpt-image-2'");
    expect(source).not.toContain('response_format');
    expect(source).not.toContain('gpt-image-1.5');
  });
});
