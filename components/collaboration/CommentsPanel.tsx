/**
 * Comments Panel Component
 *
 * @description Side panel for viewing and managing comments on content:
 * - Threaded comments with replies
 * - @mentions with autocomplete
 * - Comment resolution
 * - Real-time updates
 *
 * Usage:
 * ```tsx
 * <CommentsPanel
 *   isOpen={showComments}
 *   onClose={() => setShowComments(false)}
 *   contentType="campaign"
 *   contentId="abc123"
 * />
 * ```
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Send, MessageSquare, Check, MoreVertical, Trash2, Edit, Reply, Loader2 } from '@/components/icons';
// Alias for Edit2 compatibility
const Edit2 = Edit;
import { toast } from 'sonner';
import { fetchWithCSRF } from '@/lib/csrf';
import type { ContentType } from '@/hooks/useContentShare';

// ============================================================================
// TYPES
// ============================================================================

interface Comment {
  id: string;
  content: string;
  authorId: string;
  author: {
    id: string;
    name?: string;
    avatar?: string;
  };
  parentId?: string;
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  mentions: string[];
  createdAt: Date;
  updatedAt: Date;
  replies?: Comment[];
}

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contentType: ContentType;
  contentId: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CommentsPanel({
  isOpen,
  onClose,
  contentType,
  contentId,
}: CommentsPanelProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<TeamMember[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /**
   * Fetch comments
   */
  const fetchComments = useCallback(async () => {
    if (!contentType || !contentId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/content/comments?contentType=${contentType}&contentId=${contentId}&parentId=`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setComments(
          (data.comments || []).map((c: any) => ({
            ...c,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
            replies: (c.replies || []).map((r: any) => ({
              ...r,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          }))
        );
      }
    } catch (error) {
      console.error('Fetch comments error:', error);
      toast.error('Failed to load comments');
    } finally {
      setIsLoading(false);
    }
  }, [contentType, contentId]);

  /**
   * Load comments on open
   */
  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, fetchComments]);

  /**
   * Search for mentions
   */
  const searchMentions = useCallback(async (query: string) => {
    if (!query.trim()) {
      setMentionResults([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/teams/members/search?q=${encodeURIComponent(query)}`,
        { credentials: 'include' }
      );

      if (response.ok) {
        const data = await response.json();
        setMentionResults(data.members || []);
      }
    } catch (error) {
      console.error('Mention search error:', error);
    }
  }, []);

  /**
   * Handle input change with mention detection
   */
  const handleInputChange = (value: string, isReply = false) => {
    if (isReply) {
      // Handle reply input (simplified)
      setNewComment(value);
    } else {
      setNewComment(value);
    }

    // Detect @mention
    const cursorPos = inputRef.current?.selectionStart || 0;
    setCursorPosition(cursorPos);

    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
      searchMentions(mentionMatch[1]);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  /**
   * Insert mention
   */
  const insertMention = (member: TeamMember) => {
    const textBeforeMention = newComment.slice(0, cursorPosition).replace(/@\w*$/, '');
    const textAfterMention = newComment.slice(cursorPosition);
    const mention = `@[${member.name}](${member.id})`;

    setNewComment(textBeforeMention + mention + ' ' + textAfterMention);
    setShowMentions(false);
    setMentionQuery('');
    inputRef.current?.focus();
  };

  /**
   * Submit comment
   */
  const handleSubmit = async (parentId?: string) => {
    const content = newComment.trim();
    if (!content) return;

    setIsLoading(true);
    try {
      const response = await fetchWithCSRF('/api/content/comments', {
        method: 'POST',
        body: JSON.stringify({
          contentType,
          contentId,
          content,
          parentId,
        }),
      });

      if (response.ok) {
        setNewComment('');
        setReplyingTo(null);
        await fetchComments();
        toast.success('Comment added');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Submit comment error:', error);
      toast.error('Failed to add comment');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Update comment
   */
  const handleUpdate = async (commentId: string) => {
    if (!editContent.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetchWithCSRF(`/api/content/comments?id=${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: editContent }),
      });

      if (response.ok) {
        setEditingId(null);
        setEditContent('');
        await fetchComments();
        toast.success('Comment updated');
      }
    } catch (error) {
      console.error('Update comment error:', error);
      toast.error('Failed to update comment');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete comment
   */
  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;

    setIsLoading(true);
    try {
      const response = await fetchWithCSRF(`/api/content/comments?id=${commentId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchComments();
        toast.success('Comment deleted');
      }
    } catch (error) {
      console.error('Delete comment error:', error);
      toast.error('Failed to delete comment');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Resolve/unresolve comment
   */
  const handleToggleResolve = async (commentId: string, isResolved: boolean) => {
    setIsLoading(true);
    try {
      const response = await fetchWithCSRF(`/api/content/comments?id=${commentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isResolved: !isResolved }),
      });

      if (response.ok) {
        await fetchComments();
        toast.success(isResolved ? 'Comment reopened' : 'Comment resolved');
      }
    } catch (error) {
      console.error('Toggle resolve error:', error);
      toast.error('Failed to update comment');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Format relative time
   */
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  /**
   * Render comment content with parsed mentions
   */
  const renderContent = (content: string) => {
    const parts = content.split(/(@\[([^\]]+)\]\(([^)]+)\))/g);
    return parts.map((part, i) => {
      if (part.startsWith('@[')) {
        const match = part.match(/@\[([^\]]+)\]\(([^)]+)\)/);
        if (match) {
          return (
            <span key={i} className="text-cyan-400 font-medium">
              @{match[1]}
            </span>
          );
        }
      }
      return part;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed right-0 top-0 h-full w-96 bg-[#0a0a0a] border-l border-white/10 shadow-2xl z-50 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-cyan-500" />
          <h2 className="text-lg font-semibold text-white">Comments</h2>
          {comments.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-white/10 text-white/60 rounded-full">
              {comments.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && comments.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-cyan-500 animate-spin" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No comments yet</p>
            <p className="text-sm text-white/30">Be the first to comment</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className={`space-y-3 ${comment.isResolved ? 'opacity-60' : ''}`}
            >
              {/* Main Comment */}
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                    {comment.author?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {comment.author?.name || 'Unknown'}
                        </span>
                        <span className="text-xs text-white/40">
                          {formatTime(comment.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleResolve(comment.id, comment.isResolved)}
                          className={`p-1 rounded transition-colors ${
                            comment.isResolved
                              ? 'text-green-500 hover:bg-green-500/20'
                              : 'text-white/40 hover:text-white hover:bg-white/10'
                          }`}
                          title={comment.isResolved ? 'Reopen' : 'Resolve'}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <div className="relative group">
                          <button className="p-1 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 py-1 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[120px]">
                            <button
                              onClick={() => {
                                setEditingId(comment.id);
                                setEditContent(comment.content);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10"
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(comment.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/10"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {editingId === comment.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/20 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-cyan-500/50"
                          rows={3}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdate(comment.id)}
                            className="px-3 py-1 bg-cyan-500 text-white text-sm rounded-lg hover:bg-cyan-600"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditContent('');
                            }}
                            className="px-3 py-1 bg-white/10 text-white text-sm rounded-lg hover:bg-white/20"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">
                        {renderContent(comment.content)}
                      </p>
                    )}

                    <button
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                      className="mt-2 flex items-center gap-1 text-xs text-white/40 hover:text-cyan-400 transition-colors"
                    >
                      <Reply className="w-3 h-3" />
                      Reply
                    </button>
                  </div>
                </div>

                {/* Reply Input */}
                {replyingTo === comment.id && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="flex gap-2">
                      <textarea
                        value={newComment}
                        onChange={(e) => handleInputChange(e.target.value, true)}
                        placeholder="Write a reply..."
                        className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-cyan-500/50"
                        rows={2}
                      />
                      <button
                        onClick={() => handleSubmit(comment.id)}
                        disabled={!newComment.trim() || isLoading}
                        className="px-3 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Replies */}
              {comment.replies && comment.replies.length > 0 && (
                <div className="ml-6 space-y-2">
                  {comment.replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="bg-white/5 border border-white/10 rounded-lg p-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-500 flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                          {reply.author?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">
                              {reply.author?.name || 'Unknown'}
                            </span>
                            <span className="text-xs text-white/40">
                              {formatTime(reply.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-white/80 whitespace-pre-wrap">
                            {renderContent(reply.content)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-4">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={newComment}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Write a comment... Use @ to mention"
            className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none focus:outline-none focus:border-cyan-500/50"
            rows={3}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!newComment.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>

          {/* Mention Autocomplete */}
          {showMentions && mentionResults.length > 0 && (
            <div className="absolute left-0 bottom-full mb-2 w-full bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {mentionResults.map((member) => (
                <button
                  key={member.id}
                  onClick={() => insertMention(member)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-white/10 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-500 flex items-center justify-center text-white text-xs font-medium">
                    {member.name?.charAt(0) || member.email.charAt(0)}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm text-white">{member.name || member.email}</p>
                    {member.name && (
                      <p className="text-xs text-white/50">{member.email}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CommentsPanel;
