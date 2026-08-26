/**
 * Supabase compatibility shim.
 *
 * SYN-1070 removed @supabase/supabase-js. This file preserves the exported
 * types and IntegrationService so legacy routes continue to compile.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntegrationPlatform =
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'threads';

export interface UserIntegration {
  id: string;
  user_id: string;
  platform: IntegrationPlatform;
  credentials: string;
  account_name?: string;
  account_id?: string;
  connected_at: string;
  last_used?: string;
  status?: 'active' | 'inactive' | 'error';
}

// ---------------------------------------------------------------------------
// IntegrationService
// ---------------------------------------------------------------------------

export class IntegrationService {
  static validateCredentials(
    platform: IntegrationPlatform,
    credentials: Record<string, unknown>
  ): { valid: boolean; missing: string[] } {
    const requiredFields: Record<IntegrationPlatform, string[]> = {
      twitter: ['apiKey', 'apiSecret', 'accessToken', 'accessTokenSecret'],
      linkedin: ['clientId', 'clientSecret', 'accessToken'],
      instagram: ['accessToken', 'businessAccountId'],
      facebook: ['pageAccessToken', 'pageId'],
      tiktok: ['accessToken', 'openId'],
      youtube: ['apiKey', 'refreshToken'],
      pinterest: ['accessToken'],
      threads: ['accessToken', 'userId'],
    };

    const required = requiredFields[platform] ?? [];
    const missing = required.filter(f => !credentials[f]);
    return { valid: missing.length === 0, missing };
  }

  static async connectIntegration(
    _userId: string,
    _platform: IntegrationPlatform,
    _credentials: Record<string, unknown>,
    _accountName?: string
  ): Promise<UserIntegration> {
    throw new Error(
      'connectIntegration: migration to Prisma pending (SYN-1070)'
    );
  }

  static async disconnectIntegration(
    _userId: string,
    _platform: IntegrationPlatform
  ): Promise<void> {
    throw new Error(
      'disconnectIntegration: migration to Prisma pending (SYN-1070)'
    );
  }

  static async getUserIntegrations(
    _userId: string
  ): Promise<UserIntegration[]> {
    return [];
  }
}

// Legacy proxy — keeps `import { supabase } from '@/lib/supabase'` compiling
export const supabase: any = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === 'auth') {
        return {
          getUser: async (_token?: string) => ({
            data: { user: null },
            error: null,
          }),
        };
      }
      return undefined;
    },
  }
);
