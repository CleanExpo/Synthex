import * as fs from 'node:fs';
import * as path from 'node:path';

describe('CCW OpenAI campaign image generator', () => {
  // Archived 2026-07-12 (Real Images Only mandate, spec Part C exception #3) —
  // this one-off campaign script bypassed generateImage()'s grounding gate, so
  // it was moved to .claude/archived/ rather than rewritten. The script's
  // content is unchanged (git mv); only its path moved.
  const scriptPath = path.join(
    process.cwd(),
    '.claude/archived/2026-07-12/ungrounded-scripts/generate-ccw-openai-campaign-images.ts'
  );

  it('forces two OpenAI GPT Image 2 campaign support images', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain("const model = 'gpt-image-2'");
    expect(source).toContain("const provider = 'openai'");
    expect(source).toContain('imageSpecs: ImageSpec[]');
    expect(source).toContain('11-openai-image-generation-manifest.json');
    expect(source).toContain('openai_generated_campaign_image_set');
    expect(source).not.toContain('gemini-3-pro-image-preview');
  });
});
