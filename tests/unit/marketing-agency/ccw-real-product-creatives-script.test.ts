import * as fs from 'node:fs';
import * as path from 'node:path';

describe('CCW real product creative generator', () => {
  const scriptPath = path.join(
    process.cwd(),
    'scripts/generate-ccw-real-product-creatives.ts'
  );

  it('uses the current GPT Image 2 model for OpenAI backgrounds', () => {
    const source = fs.readFileSync(scriptPath, 'utf8');

    expect(source).toContain("const openAiImageModel = 'gpt-image-2'");
    expect(source).not.toContain('response_format');
    expect(source).not.toContain('gpt-image-1.5');
  });
});
