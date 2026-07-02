import * as fs from 'node:fs';
import * as path from 'node:path';

describe('CCW OpenAI campaign image generator', () => {
  const scriptPath = path.join(
    process.cwd(),
    'scripts/generate-ccw-openai-campaign-images.ts'
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
