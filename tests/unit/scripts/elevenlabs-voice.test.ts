import { resolveElevenLabsVoiceId } from '@/scripts/lib/elevenlabs-voice';

// Placeholder ids — never real configuration values.
const CORRECT = 'voice-id-from-correct-var';
const TYPO = 'voice-id-from-typo-var';
// The stock ElevenLabs 'Rachel' voice: the old silent fallback.
const RACHEL = '21m00Tcm4TlvDq8ikWAM';

describe('resolveElevenLabsVoiceId', () => {
  it('returns ELEVENLABS_VOICE_ID without warning', () => {
    const warn = jest.fn();
    expect(
      resolveElevenLabsVoiceId({ ELEVENLABS_VOICE_ID: CORRECT }, warn)
    ).toBe(CORRECT);
    expect(warn).not.toHaveBeenCalled();
  });

  it('prefers ELEVENLABS_VOICE_ID over a stale ELEVENLABS_VIOCE_ID', () => {
    const warn = jest.fn();
    expect(
      resolveElevenLabsVoiceId(
        { ELEVENLABS_VOICE_ID: CORRECT, ELEVENLABS_VIOCE_ID: TYPO },
        warn
      )
    ).toBe(CORRECT);
    expect(warn).not.toHaveBeenCalled();
  });

  it('accepts the ELEVENLABS_VIOCE_ID typo only as a deprecated fallback, with one warning', () => {
    const warn = jest.fn();
    expect(resolveElevenLabsVoiceId({ ELEVENLABS_VIOCE_ID: TYPO }, warn)).toBe(
      TYPO
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/ELEVENLABS_VIOCE_ID/);
    expect(warn.mock.calls[0][0]).toMatch(/deprecated/i);
    expect(warn.mock.calls[0][0]).not.toContain(TYPO);
  });

  it('warns through console.warn by default', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveElevenLabsVoiceId({ ELEVENLABS_VIOCE_ID: TYPO })).toBe(TYPO);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('throws a clear error when no voice id is configured, never the stock Rachel voice', () => {
    expect(() => resolveElevenLabsVoiceId({}, jest.fn())).toThrow(
      /ELEVENLABS_VOICE_ID is not set/
    );
  });

  it('treats a blank ELEVENLABS_VOICE_ID as missing', () => {
    expect(() =>
      resolveElevenLabsVoiceId(
        { ELEVENLABS_VOICE_ID: '  ', ELEVENLABS_VIOCE_ID: '' },
        jest.fn()
      )
    ).toThrow(/ELEVENLABS_VOICE_ID is not set/);
    const warn = jest.fn();
    expect(
      resolveElevenLabsVoiceId(
        { ELEVENLABS_VOICE_ID: '', ELEVENLABS_VIOCE_ID: TYPO },
        warn
      )
    ).toBe(TYPO);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('never resolves to the Rachel id from an empty environment', () => {
    let resolved: string | undefined;
    try {
      resolved = resolveElevenLabsVoiceId({}, jest.fn());
    } catch {
      resolved = undefined;
    }
    expect(resolved).not.toBe(RACHEL);
    expect(resolved).toBeUndefined();
  });
});
