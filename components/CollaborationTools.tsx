'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Users, 
  MessageSquare, 
  Send,
  AtSign,
  Smile,
  Paperclip,
  MoreVertical,
  Check,
  Reply,
  Heart,
  ThumbsUp,
  Laugh,
  Bell,
  BellOff,
  Edit,
  Trash2,
  Clock,
  Circle,
  CheckCircle,
  XCircle,
  MousePointer,
  Type
} from 'lucide-react';
import {
  CollaborationManager,
  type Participant,
  type Comment,
  type Notification,
  type ActiveUser
} from '@/lib/collaboration';
import { notify } from '@/lib/notifications';
import { fadeInUp, scaleIn } from '@/lib/animations';

// Get current user from localStorage
const getCurrentUser = (): Participant => {
  const stored = localStorage.getItem('user_data');
  if (stored) {
    const data = JSON.parse(stored);
    return {
      id: data.id || 'user-1',
      name: data.name || 'You',
      email: data.email || 'you@example.com',
      avatar: data.avatar,
      role: 'owner',
      color: CollaborationManager.generateUserColor(),
      joinedAt: new Date(),
      lastSeen: new Date(),
      isOnline: true
    };
  }
  
  return {
    id: 'user-1',
    name: 'You',
    email: 'you@example.com',
    role: 'owner',
    color: CollaborationManager.generateUserColor(),
    joinedAt: new Date(),
    lastSeen: new Date(),
    isOnline: true
  };
};

interface CollaborationToolsProps {
  documentId: string;
  onUserActivity?: (activity: any) => void;
}

export function CollaborationTools({ 
  documentId, 
  onUserActivity 
}: CollaborationToolsProps) {
  const [manager, setManager] = useState<CollaborationManager | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Participant[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const currentUser = getCurrentUser();
  
  // Initialize collaboration
  useEffect(() => {
    const collabManager = new CollaborationManager(currentUser.id);
    setManager(collabManager);
    
    // Join session
    collabManager.joinSession(documentId, currentUser);
    
    // Set up event listeners
    collabManager.on('user-joined', (data: any) => {
      notify.info(`${data.user.name} joined the session`);
      setOnlineUsers(collabManager.getOnlineUsers());
    });
    
    collabManager.on('user-left', (data: any) => {
      notify.info(`User left the session`);
      setOnlineUsers(collabManager.getOnlineUsers());
    });
    
    collabManager.on('comment', (comment: Comment) => {
      setComments(prev => [...prev, comment]);
      if (comment.userId !== currentUser.id) {
        notify.info(`${comment.userName} added a comment`);
      }
    });
    
    collabManager.on('typing', (data: any) => {
      if (data.userId !== currentUser.id) {
        setTypingUsers(prev => {
          const updated = new Set(prev);
          if (data.isTyping) {
            updated.add(data.userId);
          } else {
            updated.delete(data.userId);
          }
          return updated;
        });
      }
    });
    
    collabManager.on('notification', (notification: Notification) => {
      if (notification.to === currentUser.id) {
        setNotifications(prev => [notification, ...prev]);
        notify.info(notification.message);
      }
    });
    
    // Load existing data
    setComments(collabManager.getComments());
    setNotifications(collabManager.getNotifications().filter(n => n.to === currentUser.id));
    setOnlineUsers(collabManager.getOnlineUsers());
    
    return () => {
      collabManager.leaveSession(documentId, currentUser.id);
    };
  }, [documentId]);
  
  // Send comment
  const sendComment = () => {
    if (!newComment.trim() || !manager) return;
    
    // Extract mentions
    const mentions = extractMentions(newComment);
    
    const comment = manager.addComment({
      userId: currentUser.id,
      userName: currentUser.name,
      content: newComment,
      resolved: false,
      replies: [],
      mentions,
      reactions: []
    });
    
    setNewComment('');
    notify.success('Comment added');
  };
  
  // Send reply
  const sendReply = (commentId: string) => {
    if (!replyContent.trim() || !manager) return;
    
    manager.replyToComment(commentId, {
      userId: currentUser.id,
      userName: currentUser.name,
      content: replyContent
    });
    
    setReplyContent('');
    setReplyingTo(null);
    notify.success('Reply added');
  };
  
  // Add reaction
  const addReaction = (commentId: string, emoji: string) => {
    if (!manager) return;
    
    manager.addReaction(commentId, {
      emoji,
      userId: currentUser.id,
      userName: currentUser.name
    });
  };
  
  // Resolve comment
  const resolveComment = (commentId: string, resolved: boolean) => {
    if (!manager) return;
    
    manager.resolveComment(commentId, resolved);
    setComments(manager.getComments());
    notify.success(resolved ? 'Comment resolved' : 'Comment reopened');
  };
  
  // Mark notification as read
  const markNotificationRead = (notificationId: string) => {
    if (!manager) return;
    
    manager.markNotificationRead(notificationId);
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };
  
  // Extract mentions from text
  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g;
    const matches = text.matchAll(mentionRegex);
    return Array.from(matches).map(match => match[1]);
  };
  
  // Handle typing
  const handleTyping = () => {
    if (!manager) return;
    
    manager.sendTyping(true);
    
    // Clear typing after delay
    setTimeout(() => {
      manager.sendTyping(false);
    }, 1000);
  };
  
  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-4">
      {/* Online Users */}
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-2"
      >
        <div className="flex -space-x-2">
          {onlineUsers.slice(0, 5).map(user => (
            <motion.div
              key={user.id}
              whileHover={{ scale: 1.1, zIndex: 10 }}
              className="relative"
            >
              <Avatar className="h-8 w-8 border-2 border-background">
                <AvatarImage src={user.avatar} />
                <AvatarFallback style={{ backgroundColor: user.color }}>
                  {user.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              {typingUsers.has(user.id) && (
                <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                  <Type className="h-3 w-3 text-gray-600 animate-pulse" />
                </div>
              )}
            </motion.div>
          ))}
        </div>
        
        {onlineUsers.length > 5 && (
          <Badge variant="secondary" className="text-xs">
            +{onlineUsers.length - 5}
          </Badge>
        )}
        
        <span className="text-xs text-gray-400">
          {onlineUsers.length} {onlineUsers.length === 1 ? 'user' : 'users'} online
        </span>
      </motion.div>
      
      {/* Action Buttons */}
      <div className="flex gap-2">
        {/* Notifications */}
        <Button
          size="sm"
          variant="outline"
          className="relative glass-card border-white/10"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Bell className="h-4 w-4" />
          {notifications.filter(n => !n.read).length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
              {notifications.filter(n => !n.read).length}
            </span>
          )}
        </Button>
        
        {/* Comments */}
        <Button
          size="sm"
          variant="outline"
          className="glass-card border-white/10"
          onClick={() => setShowComments(!showComments)}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Comments ({comments.length})
        </Button>
      </div>
      
      {/* Comments Panel */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-96 max-h-[600px] glass-card rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Comments</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowComments(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[400px] p-4 space-y-4">
              {comments.map(comment => (
                <CommentItem
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUser.id}
                  onReply={(id) => setReplyingTo(id)}
                  onReact={addReaction}
                  onResolve={resolveComment}
                  replyingTo={replyingTo === comment.id}
                  replyContent={replyContent}
                  onReplyContentChange={setReplyContent}
                  onSendReply={() => sendReply(comment.id)}
                />
              ))}
              
              {comments.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No comments yet</p>
                  <p className="text-sm mt-1">Be the first to comment!</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-white/10">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a comment... Use @ to mention"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendComment();
                    }
                    handleTyping();
                  }}
                  className="flex-1 bg-white/5 border-white/10"
                />
                <Button
                  size="sm"
                  onClick={sendComment}
                  disabled={!newComment.trim()}
                  className="gradient-primary"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Notifications Panel */}
      <AnimatePresence>
        {showNotifications && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="w-80 max-h-[400px] glass-card rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">Notifications</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNotifications(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="overflow-y-auto max-h-[320px]">
              {notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${
                    !notification.read ? 'bg-purple-500/10' : ''
                  }`}
                  onClick={() => markNotificationRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-1.5 rounded-full ${
                      notification.type === 'mention' ? 'bg-purple-500/20' :
                      notification.type === 'comment' ? 'bg-blue-500/20' :
                      notification.type === 'reply' ? 'bg-green-500/20' :
                      'bg-gray-500/20'
                    }`}>
                      {notification.type === 'mention' && <AtSign className="h-3 w-3 text-purple-400" />}
                      {notification.type === 'comment' && <MessageSquare className="h-3 w-3 text-blue-400" />}
                      {notification.type === 'reply' && <Reply className="h-3 w-3 text-green-400" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-white">{notification.message}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(notification.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                    )}
                  </div>
                </div>
              ))}
              
              {notifications.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No notifications</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Comment Item Component
function CommentItem({
  comment,
  currentUserId,
  onReply,
  onReact,
  onResolve,
  replyingTo,
  replyContent,
  onReplyContentChange,
  onSendReply
}: {
  comment: Comment;
  currentUserId: string;
  onReply: (id: string) => void;
  onReact: (id: string, emoji: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  replyingTo: boolean;
  replyContent: string;
  onReplyContentChange: (content: string) => void;
  onSendReply: () => void;
}) {
  const reactions = ['👍', '❤️', '😂', '🎉', '🤔'];
  
  return (
    <div className={`space-y-2 ${comment.resolved ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2">
        <Avatar className="h-8 w-8">
          <AvatarFallback>{comment.userName.charAt(0)}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">{comment.userName}</span>
            <span className="text-xs text-gray-400">
              {new Date(comment.timestamp).toLocaleTimeString()}
            </span>
            {comment.resolved && (
              <Badge variant="secondary" className="text-xs">
                Resolved
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-gray-300 mt-1">{comment.content}</p>
          
          {/* Reactions */}
          {comment.reactions.length > 0 && (
            <div className="flex gap-1 mt-2">
              {Object.entries(
                comment.reactions.reduce((acc, r) => {
                  acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([emoji, count]) => (
                <Badge key={emoji} variant="secondary" className="text-xs">
                  {emoji} {count}
                </Badge>
              ))}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => onReply(comment.id)}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
            
            <div className="flex gap-1">
              {reactions.map(emoji => (
                <Button
                  key={emoji}
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => onReact(comment.id, emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
            
            {comment.userId === currentUserId && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs ml-auto"
                onClick={() => onResolve(comment.id, !comment.resolved)}
              >
                {comment.resolved ? (
                  <>
                    <Circle className="h-3 w-3 mr-1" />
                    Reopen
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Resolve
                  </>
                )}
              </Button>
            )}
          </div>
          
          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="ml-4 mt-2 space-y-2">
              {comment.replies.map(reply => (
                <div key={reply.id} className="flex items-start gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-xs">
                      {reply.userName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">{reply.userName}</span>
                      <span className="text-xs text-gray-400">
                        {new Date(reply.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mt-0.5">{reply.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Reply Input */}
          {replyingTo && (
            <div className="flex gap-2 mt-2">
              <Input
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => onReplyContentChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onSendReply();
                  }
                }}
                className="flex-1 h-8 text-xs bg-white/5 border-white/10"
                autoFocus
              />
              <Button
                size="sm"
                className="h-8 px-2"
                onClick={onSendReply}
                disabled={!replyContent.trim()}
              >
                <Send className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}