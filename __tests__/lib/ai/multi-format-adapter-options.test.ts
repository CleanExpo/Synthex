/**
 * Unit tests for adapt-option prompt wiring (AT-020).
 *
 * The Cross-Post dashboard toggles adjustLength / addHashtags; those must
 * change the adapter system prompt rather than being silently ignored.
 */

import { buildAdaptOptionInstructions } from '@/lib/ai/multi-format-adapter';

describe('buildAdaptOptionInstructions (AT-020)', () => {
  it('defaults to length reshape + hashtag add when options are omitted', () => {
    const result = buildAdaptOptionInstructions();
    expect(result.lengthInstruction).toMatch(/Reshape length/i);
    expect(result.hashtagInstruction).toMatch(
      /Add platform-appropriate hashtags/i
    );
  });

  it('honours adjustLength=false', () => {
    const result = buildAdaptOptionInstructions({ adjustLength: false });
    expect(result.lengthInstruction).toMatch(/Preserve the original length/i);
    expect(result.lengthInstruction).not.toMatch(/Reshape length/i);
  });

  it('honours addHashtags=false', () => {
    const result = buildAdaptOptionInstructions({ addHashtags: false });
    expect(result.hashtagInstruction).toMatch(/Do not add hashtags/i);
    expect(result.hashtagInstruction).not.toMatch(/Add platform-appropriate/i);
  });

  it('honours both toggles off together', () => {
    const result = buildAdaptOptionInstructions({
      adjustLength: false,
      addHashtags: false,
    });
    expect(result.lengthInstruction).toMatch(/Preserve the original length/i);
    expect(result.hashtagInstruction).toMatch(/Do not add hashtags/i);
  });
});
