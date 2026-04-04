export interface ScheduledPost {
  id: string;
  content: string;
  platforms: string[];
  scheduledTime: Date;
  status: 'scheduled' | 'published' | 'failed' | 'draft';
  media?: string[];
  hashtags?: string[];
  mentions?: string[];
  location?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  analytics?: {
    impressions?: number;
    engagement?: number;
    clicks?: number;
  };
}

export interface NewPostData {
  content: string;
  platforms: string[];
  date: Date;
  time: string;
  hashtags: string;
  isRecurring: boolean;
  recurringPattern: string;
}
