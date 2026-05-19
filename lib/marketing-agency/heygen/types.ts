export interface HeyGenConsentMetadata {
  subjectName: string;
  sourceRef: string;
  confirmedAt: string;
}

export interface HeyGenAvatarVideoRequest {
  avatarId: string;
  script: string;
  consent: HeyGenConsentMetadata | null;
}

export interface HeyGenAvatarVideoJob {
  id: string;
  provider: 'heygen';
  status: 'mocked' | 'queued';
  videoUrl?: string;
}

export interface HeyGenClientConfig {
  apiKey?: string;
}
