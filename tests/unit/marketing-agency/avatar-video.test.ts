/**
 * Unit tests for the voice→avatar composition (SYN-1007 / VS-2).
 * Fully dependency-injected — no network, no storage.
 */

import {
  generateAvatarVideo,
  VoiceGenerationFailedError,
  type GenerateAvatarVideoDeps,
  type GenerateAvatarVideoInput,
} from '@/lib/marketing-agency/studio/avatar-video';

const consent = {
  subjectName: 'Approved Presenter',
  sourceRef: 'consent-001',
  confirmedAt: '2026-05-29T00:00:00Z',
};

const input: GenerateAvatarVideoInput = {
  avatarId: 'avatar_ra',
  script: 'This week at RestoreAssist…',
  consent,
  voiceId: 'voice_ra',
};

function deps(overrides: Partial<GenerateAvatarVideoDeps> = {}): {
  d: GenerateAvatarVideoDeps;
  generateSpeech: jest.Mock;
  uploadAudio: jest.Mock;
  createAvatarVideo: jest.Mock;
} {
  const generateSpeech = jest.fn().mockResolvedValue({
    success: true,
    audioBase64: 'BASE64AUDIO',
    contentType: 'audio/mpeg',
  });
  const uploadAudio = jest.fn().mockResolvedValue('https://cdn.example.com/a.mp3');
  const createAvatarVideo = jest
    .fn()
    .mockResolvedValue({ id: 'vid_1', provider: 'heygen', status: 'queued' });
  const d: GenerateAvatarVideoDeps = {
    generateSpeech,
    uploadAudio,
    heygen: { createAvatarVideo },
    ...overrides,
  };
  return { d, generateSpeech, uploadAudio, createAvatarVideo };
}

describe('generateAvatarVideo', () => {
  it('synthesises voice, uploads it, then hands the audio URL to HeyGen', async () => {
    const { d, generateSpeech, uploadAudio, createAvatarVideo } = deps();

    const job = await generateAvatarVideo(input, d);

    expect(job).toEqual({ id: 'vid_1', provider: 'heygen', status: 'queued' });
    expect(generateSpeech).toHaveBeenCalledWith({
      text: 'This week at RestoreAssist…',
      voiceId: 'voice_ra',
      outputFormat: 'mp3_44100_128',
    });
    expect(uploadAudio).toHaveBeenCalledWith('BASE64AUDIO', 'audio/mpeg');
    const heygenArg = createAvatarVideo.mock.calls[0][0];
    expect(heygenArg.audioUrl).toBe('https://cdn.example.com/a.mp3');
    expect(heygenArg.avatarId).toBe('avatar_ra');
    expect(heygenArg.consent).toEqual(consent); // consent forwarded to HeyGen
  });

  it('throws and never calls HeyGen when voice synthesis fails', async () => {
    const { d, uploadAudio, createAvatarVideo } = deps({
      generateSpeech: jest.fn().mockResolvedValue({ success: false, error: 'quota' }),
    });

    await expect(generateAvatarVideo(input, d)).rejects.toBeInstanceOf(
      VoiceGenerationFailedError
    );
    expect(uploadAudio).not.toHaveBeenCalled();
    expect(createAvatarVideo).not.toHaveBeenCalled();
  });

  it('throws when voice synthesis returns no audio payload', async () => {
    const { d, createAvatarVideo } = deps({
      generateSpeech: jest.fn().mockResolvedValue({ success: true }),
    });
    await expect(generateAvatarVideo(input, d)).rejects.toBeInstanceOf(
      VoiceGenerationFailedError
    );
    expect(createAvatarVideo).not.toHaveBeenCalled();
  });
});
