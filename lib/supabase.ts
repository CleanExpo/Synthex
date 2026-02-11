import { createClient } from '@supabase/supabase-js';
import { encryptCredentials, decryptCredentials } from './encryption';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Public client for client-side operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Service client for server-side operations (has elevated privileges)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Types for our database schema
export type IntegrationPlatform = 
  | 'twitter'
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'threads';

export type IntegrationStatus = 
  | 'active'
  | 'expired'
  | 'error'
  | 'disconnected';

export interface UserIntegration {
  id: string;
  user_id: string;
  platform: IntegrationPlatform;
  credentials: string; // Encrypted
  account_name?: string;
  account_id?: string;
  connected_at: string;
  last_used?: string;
  last_sync?: string;
  status: IntegrationStatus;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface IntegrationLog {
  id: string;
  user_id: string;
  integration_id?: string;
  platform: IntegrationPlatform;
  event_type: string;
  event_data?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
}

// Integration management functions
export class IntegrationService {
  /**
   * Connect a new integration for a user
   */
  static async connectIntegration(
    userId: string,
    platform: IntegrationPlatform,
    credentials: Record<string, unknown>,
    accountName?: string
  ): Promise<UserIntegration> {
    const encryptionKey = process.env.ENCRYPTION_KEY!;
    
    // Encrypt credentials
    const encryptedCredentials = encryptCredentials(credentials, encryptionKey);
    
    // Insert or update integration
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .upsert({
        user_id: userId,
        platform,
        credentials: encryptedCredentials,
        account_name: accountName,
        status: 'active',
        connected_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform'
      })
      .select()
      .single();
    
    if (error) throw error;
    
    // Log the connection event
    await this.logEvent(userId, data.id, platform, 'connect');
    
    return data;
  }
  
  /**
   * Get all integrations for a user
   */
  static async getUserIntegrations(userId: string): Promise<UserIntegration[]> {
    const { data, error } = await supabase
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .order('connected_at', { ascending: false });
    
    if (error) throw error;
    
    return data || [];
  }
  
  /**
   * Get a specific integration with decrypted credentials (server-side only)
   */
  static async getIntegrationWithCredentials(
    userId: string,
    platform: IntegrationPlatform
  ): Promise<{ integration: UserIntegration; credentials: Record<string, unknown> }> {
    const encryptionKey = process.env.ENCRYPTION_KEY!;
    
    // Get integration from database
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .eq('status', 'active')
      .single();
    
    if (error) throw error;
    if (!data) throw new Error('Integration not found');
    
    // Decrypt credentials
    const credentials = decryptCredentials(data.credentials, encryptionKey);
    
    return {
      integration: data,
      credentials
    };
  }
  
  /**
   * Disconnect an integration
   */
  static async disconnectIntegration(
    userId: string,
    platform: IntegrationPlatform
  ): Promise<void> {
    // Update status to disconnected
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .update({
        status: 'disconnected',
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('platform', platform)
      .select()
      .single();
    
    if (error) throw error;
    
    // Log the disconnection event
    await this.logEvent(userId, data.id, platform, 'disconnect');
  }
  
  /**
   * Update integration status
   */
  static async updateIntegrationStatus(
    userId: string,
    platform: IntegrationPlatform,
    status: IntegrationStatus,
    errorMessage?: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('user_integrations')
      .update({
        status,
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('platform', platform);
    
    if (error) throw error;
  }
  
  /**
   * Log an integration event
   */
  static async logEvent(
    userId: string,
    integrationId: string,
    platform: IntegrationPlatform,
    eventType: string,
    eventData?: Record<string, unknown>,
    errorMessage?: string
  ): Promise<void> {
    const { error } = await supabaseAdmin
      .from('integration_logs')
      .insert({
        user_id: userId,
        integration_id: integrationId,
        platform,
        event_type: eventType,
        event_data: eventData,
        error_message: errorMessage
      });
    
    if (error) {
      console.error('Failed to log integration event:', error);
    }
  }
  
  /**
   * Get integration statistics for a user
   */
  static async getIntegrationStats(userId: string): Promise<any> {
    const { data, error } = await supabase
      .from('integration_statistics')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    return data;
  }
  
  /**
   * Validate platform credentials before saving
   */
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
      threads: ['accessToken', 'userId']
    };
    
    const required = requiredFields[platform] || [];
    const missing = required.filter(field => !credentials[field]);
    
    return {
      valid: missing.length === 0,
      missing
    };
  }
}