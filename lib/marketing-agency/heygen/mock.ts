import type { HeyGenAvatarVideoJob, HeyGenAvatarVideoRequest } from './types';

export function createMockHeyGenAvatarVideo(request: HeyGenAvatarVideoRequest): HeyGenAvatarVideoJob {
  return {
    id: `mock-heygen-${request.avatarId}`,
    provider: 'heygen',
    status: 'mocked',
    videoUrl: `mock://heygen/videos/${request.avatarId}`,
  };
}
