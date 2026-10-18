// SYN-507: Fetch client videos for VideoObject schema injection
import {
  FEATURE_NOT_PROVISIONED,
  notProvisionedBody,
} from '@/lib/api/not-provisioned';

export interface ClientVideo {
  id: string;
  youtube_video_id: string;
  title: string;
  description?: string | null;
  thumbnail_url?: string | null;
  upload_date?: string | null;
  duration_iso?: string | null;
  published_at: string;
}

/** The client_videos table is not in prisma/schema.prisma. */
export class ClientVideosNotProvisionedError extends Error {
  readonly code = FEATURE_NOT_PROVISIONED;
  readonly table = 'client_videos';

  constructor() {
    super(notProvisionedBody('client_videos', 'Client videos').message);
    this.name = 'ClientVideosNotProvisionedError';
  }
}

/**
 * Always throws ClientVideosNotProvisionedError until client_videos is
 * provisioned. It never returns an empty list in place of a failed read.
 */
export async function getClientVideos(
  _clientId: string
): Promise<ClientVideo[]> {
  throw new ClientVideosNotProvisionedError();
}
