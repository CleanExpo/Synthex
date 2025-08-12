/**
 * Real-time Collaboration System
 * Enables team collaboration with live updates
 */

export interface CollaborationSession {
  id: string;
  documentId: string;
  participants: Participant[];
  activeUsers: ActiveUser[];
  changes: Change[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: 'owner' | 'editor' | 'viewer' | 'commenter';
  color: string;
  joinedAt: Date;
  lastSeen: Date;
  isOnline: boolean;
}

export interface ActiveUser {
  userId: string;
  cursor?: CursorPosition;
  selection?: Selection;
  isTyping: boolean;
  lastActivity: Date;
}

export interface CursorPosition {
  x: number;
  y: number;
  elementId?: string;
}

export interface Selection {
  start: number;
  end: number;
  text: string;
}

export interface Change {
  id: string;
  userId: string;
  type: 'insert' | 'delete' | 'format' | 'comment';
  content: string;
  position: number;
  timestamp: Date;
  metadata?: any;
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
  resolved: boolean;
  replies: Reply[];
  mentions: string[];
  reactions: Reaction[];
  position?: CommentPosition;
}

export interface Reply {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: Date;
}

export interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface CommentPosition {
  elementId: string;
  x: number;
  y: number;
}

export interface Notification {
  id: string;
  type: 'mention' | 'comment' | 'reply' | 'reaction' | 'share' | 'edit';
  from: string;
  to: string;
  message: string;
  link?: string;
  read: boolean;
  timestamp: Date;
}

// Collaboration Manager
export class CollaborationManager {
  private sessions: Map<string, CollaborationSession> = new Map();
  private socket: WebSocket | null = null;
  private currentSession: CollaborationSession | null = null;
  private userId: string;
  private listeners: Map<string, Function[]> = new Map();
  
  constructor(userId: string) {
    this.userId = userId;
    this.initializeWebSocket();
  }
  
  // Initialize WebSocket connection
  private initializeWebSocket() {
    // In production, connect to real WebSocket server
    // For now, simulate with local events
    if (typeof window !== 'undefined') {
      // Simulate WebSocket with broadcast channel
      const channel = new BroadcastChannel('collaboration');
      
      channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      
      // Store channel as socket substitute
      (this as any).channel = channel;
    }
  }
  
  // Join collaboration session
  async joinSession(documentId: string, user: Participant): Promise<CollaborationSession> {
    let session = this.sessions.get(documentId);
    
    if (!session) {
      session = {
        id: `session-${Date.now()}`,
        documentId,
        participants: [],
        activeUsers: [],
        changes: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.sessions.set(documentId, session);
    }
    
    // Add user to session
    const existingUser = session.participants.find(p => p.id === user.id);
    if (existingUser) {
      existingUser.isOnline = true;
      existingUser.lastSeen = new Date();
    } else {
      session.participants.push({
        ...user,
        isOnline: true,
        joinedAt: new Date(),
        lastSeen: new Date()
      });
    }
    
    // Add to active users
    session.activeUsers.push({
      userId: user.id,
      isTyping: false,
      lastActivity: new Date()
    });
    
    this.currentSession = session;
    this.broadcast('user-joined', { session, user });
    
    return session;
  }
  
  // Leave session
  leaveSession(documentId: string, userId: string) {
    const session = this.sessions.get(documentId);
    if (!session) return;
    
    const participant = session.participants.find(p => p.id === userId);
    if (participant) {
      participant.isOnline = false;
      participant.lastSeen = new Date();
    }
    
    session.activeUsers = session.activeUsers.filter(u => u.userId !== userId);
    
    this.broadcast('user-left', { sessionId: documentId, userId });
  }
  
  // Send cursor position
  sendCursor(position: CursorPosition) {
    if (!this.currentSession) return;
    
    const activeUser = this.currentSession.activeUsers.find(u => u.userId === this.userId);
    if (activeUser) {
      activeUser.cursor = position;
      activeUser.lastActivity = new Date();
    }
    
    this.broadcast('cursor-move', { userId: this.userId, position });
  }
  
  // Send selection
  sendSelection(selection: Selection) {
    if (!this.currentSession) return;
    
    const activeUser = this.currentSession.activeUsers.find(u => u.userId === this.userId);
    if (activeUser) {
      activeUser.selection = selection;
      activeUser.lastActivity = new Date();
    }
    
    this.broadcast('selection', { userId: this.userId, selection });
  }
  
  // Send typing indicator
  sendTyping(isTyping: boolean) {
    if (!this.currentSession) return;
    
    const activeUser = this.currentSession.activeUsers.find(u => u.userId === this.userId);
    if (activeUser) {
      activeUser.isTyping = isTyping;
      activeUser.lastActivity = new Date();
    }
    
    this.broadcast('typing', { userId: this.userId, isTyping });
  }
  
  // Send change
  sendChange(change: Omit<Change, 'id' | 'timestamp'>) {
    if (!this.currentSession) return;
    
    const fullChange: Change = {
      ...change,
      id: `change-${Date.now()}`,
      timestamp: new Date()
    };
    
    this.currentSession.changes.push(fullChange);
    this.currentSession.updatedAt = new Date();
    
    this.broadcast('change', fullChange);
    
    return fullChange;
  }
  
  // Add comment
  addComment(comment: Omit<Comment, 'id' | 'timestamp'>): Comment {
    const fullComment: Comment = {
      ...comment,
      id: `comment-${Date.now()}`,
      timestamp: new Date()
    };
    
    // Store comment (in production, save to database)
    const comments = this.getComments();
    comments.push(fullComment);
    if (typeof window !== 'undefined') {
      localStorage.setItem('collaboration_comments', JSON.stringify(comments));
    }
    
    // Notify mentioned users
    fullComment.mentions.forEach(userId => {
      this.sendNotification({
        type: 'mention',
        from: comment.userId,
        to: userId,
        message: `${comment.userName} mentioned you in a comment`
      });
    });
    
    this.broadcast('comment', fullComment);
    
    return fullComment;
  }
  
  // Reply to comment
  replyToComment(commentId: string, reply: Omit<Reply, 'id' | 'timestamp'>): Reply {
    const fullReply: Reply = {
      ...reply,
      id: `reply-${Date.now()}`,
      timestamp: new Date()
    };
    
    const comments = this.getComments();
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      comment.replies.push(fullReply);
      if (typeof window !== 'undefined') {
        localStorage.setItem('collaboration_comments', JSON.stringify(comments));
      }
      
      // Notify comment author
      this.sendNotification({
        type: 'reply',
        from: reply.userId,
        to: comment.userId,
        message: `${reply.userName} replied to your comment`
      });
      
      this.broadcast('reply', { commentId, reply: fullReply });
    }
    
    return fullReply;
  }
  
  // Add reaction
  addReaction(commentId: string, reaction: Reaction) {
    const comments = this.getComments();
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      // Remove existing reaction from same user
      comment.reactions = comment.reactions.filter(r => r.userId !== reaction.userId);
      comment.reactions.push(reaction);
      if (typeof window !== 'undefined') {
        localStorage.setItem('collaboration_comments', JSON.stringify(comments));
      }
      
      this.broadcast('reaction', { commentId, reaction });
    }
  }
  
  // Resolve comment
  resolveComment(commentId: string, resolved: boolean) {
    const comments = this.getComments();
    const comment = comments.find(c => c.id === commentId);
    if (comment) {
      comment.resolved = resolved;
      if (typeof window !== 'undefined') {
        localStorage.setItem('collaboration_comments', JSON.stringify(comments));
      }
      
      this.broadcast('comment-resolved', { commentId, resolved });
    }
  }
  
  // Send notification
  private sendNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
    const fullNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      timestamp: new Date(),
      read: false
    };
    
    // Store notification
    const notifications = this.getNotifications();
    notifications.push(fullNotification);
    if (typeof window !== 'undefined') {
      localStorage.setItem('collaboration_notifications', JSON.stringify(notifications));
    }
    
    this.broadcast('notification', fullNotification);
  }
  
  // Get comments
  getComments(): Comment[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('collaboration_comments');
    return stored ? JSON.parse(stored) : [];
  }
  
  // Get notifications
  getNotifications(): Notification[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('collaboration_notifications');
    return stored ? JSON.parse(stored) : [];
  }
  
  // Mark notification as read
  markNotificationRead(notificationId: string) {
    const notifications = this.getNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('collaboration_notifications', JSON.stringify(notifications));
      }
    }
  }
  
  // Broadcast message
  private broadcast(type: string, data: any) {
    const message = { type, data, timestamp: Date.now() };
    
    // Use broadcast channel
    if ((this as any).channel) {
      (this as any).channel.postMessage(message);
    }
    
    // Trigger local listeners
    const listeners = this.listeners.get(type) || [];
    listeners.forEach(listener => listener(data));
  }
  
  // Handle incoming message
  private handleMessage(message: any) {
    const listeners = this.listeners.get(message.type) || [];
    listeners.forEach(listener => listener(message.data));
  }
  
  // Subscribe to events
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }
  
  // Unsubscribe from events
  off(event: string, callback: Function) {
    const listeners = this.listeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }
  
  // Get online users
  getOnlineUsers(): Participant[] {
    if (!this.currentSession) return [];
    return this.currentSession.participants.filter(p => p.isOnline);
  }
  
  // Get user color
  getUserColor(userId: string): string {
    if (!this.currentSession) return '#8b5cf6';
    const participant = this.currentSession.participants.find(p => p.id === userId);
    return participant?.color || '#8b5cf6';
  }
  
  // Generate unique color for user
  static generateUserColor(): string {
    const colors = [
      '#ef4444', // red
      '#f97316', // orange
      '#f59e0b', // amber
      '#eab308', // yellow
      '#84cc16', // lime
      '#22c55e', // green
      '#10b981', // emerald
      '#14b8a6', // teal
      '#06b6d4', // cyan
      '#0ea5e9', // sky
      '#3b82f6', // blue
      '#6366f1', // indigo
      '#8b5cf6', // violet
      '#a855f7', // purple
      '#d946ef', // fuchsia
      '#ec4899', // pink
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
  }
}