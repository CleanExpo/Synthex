import { prisma } from '@/lib/prisma';
import { verifyTokenSafe } from '@/lib/auth/jwt-utils';

export interface PersonaInput {
  name: string;
  description?: string;
  voice_tone?: string;
  target_audience?: string;
  platforms?: string[];
  brand_guidelines?: string;
  [key: string]: unknown;
}

export interface ContentInput {
  title?: string;
  body: string;
  platform?: string;
  persona_id?: string;
  status?: 'draft' | 'scheduled' | 'published';
  scheduled_at?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CampaignInput {
  name: string;
  description?: string;
  platform?: string;
  start_date?: string;
  end_date?: string;
  status?: 'draft' | 'active' | 'paused' | 'completed';
  goals?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface PatternInput {
  platform: string;
  pattern_type: string;
  pattern_data: Record<string, unknown>;
  engagement_score: number;
}

export const auth = {
  async signOut() {
    return undefined;
  },

  async getUser(_token?: string) {
    const user = await this.getCurrentUser();
    return { data: { user }, error: user ? null : new Error('Unauthorized') };
  },

  async getCurrentUser() {
    if (typeof window === 'undefined') {
      return null;
    }

    const token = document.cookie
      .split('; ')
      .find(cookie => cookie.startsWith('auth-token='))
      ?.split('=')
      .slice(1)
      .join('=');

    const payload = token ? verifyTokenSafe(decodeURIComponent(token)) : null;
    return payload ? { id: payload.userId, email: payload.email ?? '' } : null;
  },

  async resetPassword() {
    return {
      error: {
        message:
          'Password resets are handled via /api/auth/request-reset and /api/auth/reset-password.',
      },
    };
  },

  onAuthStateChange() {
    return {
      data: {
        subscription: {
          unsubscribe() {
            return undefined;
          },
        },
      },
    };
  },
};

export const db = {
  content: {
    async create(userId: string, content: ContentInput) {
      const platform = content.platform || 'generic';
      return prisma.contentDraft.create({
        data: {
          userId,
          title: content.title || content.body.slice(0, 120),
          content: content.body,
          platform,
          ...(content.metadata && { metadata: content.metadata as any }),
          status: content.status || 'draft',
        },
      });
    },
  },
  patterns: {
    async list(_platform?: string) {
      return [];
    },
    async create(pattern: PatternInput) {
      return {
        id: `pattern-${Date.now()}`,
        ...pattern,
        discovered_at: new Date().toISOString(),
      };
    },
  },
};

export const realtime = {
  subscribeToContent() {
    return null;
  },
  subscribeToCampaigns() {
    return null;
  },
  unsubscribe() {
    return undefined;
  },
};

export const storage = {
  async uploadFile(_bucket: string, path: string) {
    return { path };
  },
  async getFileUrl(_bucket: string, path: string) {
    return path;
  },
  async deleteFile() {
    return true;
  },
};

export const platformClient = {
  auth,
  from() {
    return {
      select() {
        return this;
      },
      eq() {
        return this;
      },
      limit() {
        return Promise.resolve({ data: [], error: null });
      },
    };
  },
};

export { platformClient as platform };

export async function testConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { connected: true, message: 'Database connection successful' };
  } catch (error: unknown) {
    return {
      connected: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
