/**
 * Real-time WebSocket Service
 * Handles live updates and notifications
 */

import { createClient, RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeMessage {
  id: string;
  type: 'notification' | 'update' | 'alert' | 'message';
  title?: string;
  content: string;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface RealtimePresence {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  metadata?: Record<string, any>;
}

class RealtimeService {
  private supabase: any;
  private channels: Map<string, RealtimeChannel> = new Map();
  private listeners: Map<string, Set<Function>> = new Map();
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
    onUpdate?: (payload: any) => void;
  }): Promise<RealtimeChannel | null> {
    if (!this.supabase) return null;

    // Check if already subscribed
    if (this.channels.has(channelName)) {
      return this.channels.get(channelName)!;
    }

    const channel = this.supabase.channel(channelName);

    // Handle broadcast messages
    if (options?.onMessage) {
      channel.on('broadcast', { event: 'message' }, (payload: any) => {
        options.onMessage(payload.payload as RealtimeMessage);
      });
    }

    // Handle presence sync
    if (options?.onPresence) {
      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const presenceList = Object.values(state).flat() as RealtimePresence[];
        options.onPresence(presenceList);
        
        // Update local presence data
        presenceList.forEach(p => {
          this.presenceData.set(p.userId, p);
        });
      });

      channel.on('presence', { event: 'join' }, ({ key, newPresences }: any) => {
        console.log('User joined:', key, newPresences);
      });

      channel.on('presence', { event: 'leave' }, ({ key, leftPresences }: any) => {
        console.log('User left:', key, leftPresences);
      });
    }

    // Handle database changes
    if (options?.onUpdate) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload: any) => {
          options.onUpdate(payload);
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
    callback: (payload: any) => void,
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
        (payload: any) => {
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
  subscribeToNotifications(userId: string, callback: (notification: any) => void) {
    return this.subscribeToTable(
      'notifications',
      callback,
      `user_id=eq.${userId}`
    );
  }

  /**
   * Subscribe to post updates
   */
  subscribeToPostUpdates(callback: (update: any) => void) {
    return this.subscribeToTable('content_posts', (payload) => {
      callback({
        type: payload.eventType,
        post: payload.new || payload.old,
        timestamp: new Date()
      });
    });
  }

  /**
   * Subscribe to analytics events
   */
  subscribeToAnalytics(callback: (event: any) => void) {
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