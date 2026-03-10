/**
 * Real-time WebSocket Service
 * Handles live updates and notifications
 */

import { createClient, RealtimeChannel, SupabaseClient, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

/** Generic database record type - exported for consumers */
export interface DbRecord {
  id?: string;
  status?: string;
  content?: string;
  platform?: string;
  likes?: number;
  comments?: number;
  read?: boolean;
  title?: string;
  message?: string;
  type?: string;
  action_url?: string;
  created_at?: string;
  [key: string]: unknown;
}

/** Postgres changes payload type - exported for consumers */
export type DbChangePayload = RealtimePostgresChangesPayload<DbRecord>;

/** Presence join/leave event type */
interface PresenceEvent {
  key: string;
  newPresences?: RealtimePresence[];
  currentPresences?: RealtimePresence[];
  leftPresences?: RealtimePresence[];
}

/** Notification record from database */
export interface NotificationRecord {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  action_url?: string;
  read: boolean;
  created_at: string;
  read_at?: string;
}

/** Post update event */
export interface PostUpdateEvent {
  type: string;
  post: Record<string, unknown>;
  timestamp: Date;
}

export interface RealtimeMessage {
  id: string;
  type: 'notification' | 'update' | 'alert' | 'message';
  title?: string;
  content: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface RealtimePresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  metadata?: Record<string, unknown>;
}

class RealtimeService {
  private supabase: SupabaseClient | null = null;
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private presenceData: Map<string, RealtimePresence> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      this.supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
    }
  }

  /**
   * Subscribe to a channel
   */
  async subscribeToChannel(channelName: string, options?: {
    onMessage?: (message: RealtimeMessage) => void;
    onPresence?: (presence: RealtimePresence[]) => void;
    onUpdate?: (payload: DbChangePayload) => void;
  }): Promise<RealtimeChannel | null> {
    if (!this.supabase) return null;

    // Check if already subscribed
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.supabase.channel(channelName);

    // Handle broadcast messages
    if (options?.onMessage) {
      channel.on('broadcast', { event: 'message' }, (payload: { payload: RealtimeMessage }) => {
        options.onMessage?.(payload.payload);
      });
    }

    // Handle presence sync
    if (options?.onPresence) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presenceList = Object.values(state).flat() as unknown as RealtimePresence[];
        options.onPresence?.(presenceList);
        
        // Update local presence data
        presenceList.forEach(p => {
          this.presenceData.set(p.userId, p);
        });
      });

      channel.on('presence', { event: 'join' }, (_event: PresenceEvent) => {
        // Handle presence join event
      });

      channel.on('presence', { event: 'leave' }, (_event: PresenceEvent) => {
        // Handle presence leave event
      });
    }

    // Handle database changes
    if (options?.onUpdate) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload: DbChangePayload) => {
          options.onUpdate?.(payload);
        }
      );
    }

    // Subscribe to channel
    await channel.subscribe();
    this.channels.set(channelName, channel);

    return channel;
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelName: string, message: RealtimeMessage): Promise<boolean> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      console.error(`Not subscribed to channel: ${channelName}`);
      return false;
    }

    const response = await channel.send({
      type: 'broadcast',
      event: 'message',
      payload: message
    });

    return response === 'ok';
  }

  /**
   * Update presence status
   */
  async updatePresence(channelName: string, status: RealtimePresence): Promise<boolean> {
    const channel = this.channels.get(channelName);
    if (!channel) {
      console.error(`Not subscribed to channel: ${channelName}`);
      return false;
    }

    const response = await channel.track(status);
    return response === 'ok';
  }

  /**
   * Subscribe to database table changes
   */
  subscribeToTable(
    table: string,
    callback: (payload: DbChangePayload) => void,
    filter?: string
  ): RealtimeChannel | null {
    if (!this.supabase) return null;

    const channelName = `db-${table}`;
    const channel = this.supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          filter: filter
        },
        (payload: DbChangePayload) => {
          callback(payload);
        }
      )
      .subscribe();

    this.channels.set(channelName, channel);
    return channel;
  }

  /**
   * Subscribe to user notifications
   */
  subscribeToNotifications(userId: string, callback: (notification: DbChangePayload) => void) {
    return this.subscribeToTable(
      'notifications',
      callback,
      `user_id=eq.${userId}`
    );
  }

  /**
   * Subscribe to post updates
   */
  subscribeToPostUpdates(callback: (update: PostUpdateEvent) => void) {
    return this.subscribeToTable('content_posts', (payload: DbChangePayload) => {
      callback({
        type: payload.eventType,
        post: (payload.new || payload.old || {}) as Record<string, unknown>,
        timestamp: new Date()
      });
    });
  }

  /**
   * Subscribe to analytics events
   */
  subscribeToAnalytics(callback: (event: DbChangePayload) => void) {
    return this.subscribeToTable('analytics_events', callback);
  }

  /**
   * Get online users
   */
  getOnlineUsers(): RealtimePresence[] {
    return Array.from(this.presenceData.values()).filter(
      p => p.status === 'online'
    );
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(channelName: string): Promise<void> {
    const channel = this.channels.get(channelName);
    if (channel) {
      await channel.unsubscribe();
      this.channels.delete(channelName);
    }
  }

  /**
   * Unsubscribe from all channels
   */
  async unsubscribeAll(): Promise<void> {
    for (const [name, channel] of this.channels) {
      await channel.unsubscribe();
    }
    this.channels.clear();
    this.listeners.clear();
    this.presenceData.clear();
  }

  /**
   * Send a notification to specific users
   */
  async sendNotification(userIds: string[], notification: {
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    actionUrl?: string;
  }): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert(
          userIds.map(userId => ({
            user_id: userId,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            action_url: notification.actionUrl,
            read: false,
            created_at: new Date().toISOString()
          }))
        );

      return !error;
    } catch (err) {
      console.error('Failed to send notification:', err);
      return false;
    }
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsRead(notificationIds: string[]): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .in('id', notificationIds);

      return !error;
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
      return false;
    }
  }

  /**
   * Get user notification count
   */
  async getUnreadCount(userId: string): Promise<number> {
    if (!this.supabase) return 0;

    try {
      const { count, error } = await this.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      return error ? 0 : (count || 0);
    } catch (err) {
      console.error('Failed to get unread count:', err);
      return 0;
    }
  }
}

// Create singleton instance
export const realtimeService = new RealtimeService();

// Export types
export type { RealtimeChannel };