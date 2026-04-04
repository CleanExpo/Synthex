/**
 * Content Generator Types
 */

export interface HookType {
  value: string;
  label: string;
  description: string;
}

export interface ToneOption {
  value: string;
  label: string;
}

export interface Persona {
  id: string;
  name: string;
}

export interface ContentMetadata {
  platform: string;
  hookType: string;
  length: number;
  estimatedEngagement: number;
  hashtags: string[];
}

export interface GeneratedContentData {
  primary: string;
  variations: string[];
  metadata: ContentMetadata;
}
