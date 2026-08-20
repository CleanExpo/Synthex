// SYN-507: Fetch client videos for VideoObject schema injection
import { createClient } from '@/lib/platform/noop-client';

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

export async function getClientVideos(clientId: string): Promise<ClientVideo[]> {

  const platform = createClient();
  const { data, error } = await platform
    .from('client_videos')
    .select('id, youtube_video_id, title, description, thumbnail_url, upload_date, duration_iso, published_at')
    .eq('client_id', clientId)
    .order('published_at', { ascending: false })
    .limit(10);

  if (error) return [];
  return (data ?? []) as ClientVideo[];
}
