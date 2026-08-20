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

class PlatformRealtimeService {
  async subscribeToChannel(..._args: any[]) {
    return null;
  }

  async sendMessage() {
    return false;
  }

  async updatePresence() {
    return false;
  }

  subscribeToTable(..._args: any[]) {
    return null;
  }

  subscribeToNotifications(..._args: any[]) {
    return null;
  }

  unsubscribe(..._args: any[]) {
    return undefined;
  }

  getUnreadCount(..._args: any[]) {
    return 0;
  }

  async markNotificationsRead(..._args: any[]) {
    return true;
  }
}

export const realtimeService = new PlatformRealtimeService();
