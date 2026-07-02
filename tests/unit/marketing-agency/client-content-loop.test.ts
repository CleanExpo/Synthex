/**
 * Unit tests for the per-client content loop (SYN-1005 / VS-3+VS-4+VS-5).
 * Verifies the autonomous prepare step and the HARD human-approval publish gate.
 */

import {
  prepareClientUpdate,
  publishApprovedUpdate,
  NotApprovedError,
  type ClientStudioConfig,
  type PrepareDeps,
  type PublishDeps,
  type StudioDraft,
} from '@/lib/marketing-agency/studio/client-content-loop';
import { RESTOREASSIST_STUDIO_CONFIG } from '@/lib/marketing-agency/studio/clients';

const config: ClientStudioConfig = {
  clientSlug: 'restoreassist',
  displayName: 'RestoreAssist',
  avatarId: 'avatar_ra',
  voiceId: 'voice_ra',
  consent: { subjectName: 'Presenter', sourceRef: 'c1', confirmedAt: '2026-05-29T00:00:00Z' },
  platforms: ['linkedin', 'youtube'],
};

describe('prepareClientUpdate (autonomous half)', () => {
  it('generates a script, renders an avatar video, and returns an awaiting_approval draft', async () => {
    const generateScript = jest
      .fn()
      .mockResolvedValue({ topic: 'Water damage response times', script: 'Script body' });
    const generateAvatarVideo = jest
      .fn()
      .mockResolvedValue({ id: 'vid_1', provider: 'heygen', status: 'queued' });
    const persistDraft = jest.fn().mockResolvedValue(undefined);
    const deps: PrepareDeps = { generateScript, generateAvatarVideo, persistDraft };

    const draft = await prepareClientUpdate(config, { topicHint: 'response times' }, deps);

    expect(draft.status).toBe('awaiting_approval');
    expect(draft.topic).toBe('Water damage response times');
    expect(draft.platforms).toEqual(['linkedin', 'youtube']);
    // avatar render used the client's avatar/voice/consent
    const avArg = generateAvatarVideo.mock.calls[0][0];
    expect(avArg.avatarId).toBe('avatar_ra');
    expect(avArg.voiceId).toBe('voice_ra');
    expect(avArg.consent).toEqual(config.consent);
    expect(avArg.script).toBe('Script body');
    expect(persistDraft).toHaveBeenCalledWith(draft);
  });
});

describe('publishApprovedUpdate (human-approval gate)', () => {
  const draft: StudioDraft = {
    clientSlug: 'restoreassist',
    topic: 'Water damage response times',
    script: 'Script body',
    video: { id: 'vid_1', provider: 'heygen', status: 'completed', videoUrl: 'https://cdn/v.mp4' },
    platforms: ['linkedin', 'youtube'],
    status: 'awaiting_approval',
  };

  it('REFUSES to publish when not approved (gate) — publish never called', async () => {
    const publish = jest.fn();
    const emitEvent = jest.fn();
    await expect(
      publishApprovedUpdate(draft, { approved: false }, { publish, emitEvent })
    ).rejects.toBeInstanceOf(NotApprovedError);
    expect(publish).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });

  it('publishes to every platform and emits a measurement event per surface when approved', async () => {
    const publish = jest
      .fn()
      .mockImplementation(async ({ platform }) => ({ platform, postId: `post_${platform}` }));
    const emitEvent = jest.fn().mockResolvedValue(undefined);
    const deps: PublishDeps = { publish, emitEvent };

    const result = await publishApprovedUpdate(
      draft,
      { approved: true, approvedBy: 'phill' },
      deps
    );

    expect(publish).toHaveBeenCalledTimes(2);
    expect(emitEvent).toHaveBeenCalledTimes(2);
    expect(result.published).toEqual([
      { platform: 'linkedin', postId: 'post_linkedin' },
      { platform: 'youtube', postId: 'post_youtube' },
    ]);
    // published the rendered video URL, not a placeholder
    expect(publish.mock.calls[0][0].videoUrl).toBe('https://cdn/v.mp4');
  });

  it('refuses to publish a draft whose video has not finished rendering', async () => {
    const publish = jest.fn();
    const unrendered: StudioDraft = {
      ...draft,
      video: { id: 'vid_1', provider: 'heygen', status: 'queued' },
    };
    await expect(
      publishApprovedUpdate(unrendered, { approved: true }, { publish })
    ).rejects.toThrow(/has not finished rendering/);
    expect(publish).not.toHaveBeenCalled();
  });
});

describe('RESTOREASSIST_STUDIO_CONFIG (pilot placeholder)', () => {
  it('targets linkedin + youtube and carries consent metadata', () => {
    expect(RESTOREASSIST_STUDIO_CONFIG.clientSlug).toBe('restoreassist');
    expect(RESTOREASSIST_STUDIO_CONFIG.platforms).toEqual(['linkedin', 'youtube']);
    expect(RESTOREASSIST_STUDIO_CONFIG.consent.subjectName).toBeTruthy();
  });
});
