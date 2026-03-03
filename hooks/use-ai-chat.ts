/**
 * AI Chat Assistant Hooks
 *
 * @description Hooks for managing AI chat conversations and streaming messages.
 * Uses direct fetch with EventSource for SSE streaming.
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_APP_URL: Application base URL (PUBLIC)
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchWithCSRF } from '@/lib/csrf';

// ============================================================================
// TYPES
// ============================================================================

export interface ChatConversation {
  id: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  latencyMs?: number;
  createdAt: string;
}

interface ConversationsResponse {
  success: boolean;
  conversations: ChatConversation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
  upgradeRequired?: boolean;
}

interface ConversationResponse {
  success: boolean;
  conversation: ChatConversation;
  messages: ChatMessage[];
  error?: string;
  upgradeRequired?: boolean;
}

interface CreateConversationResponse {
  success: boolean;
  conversation: ChatConversation;
  error?: string;
  upgradeRequired?: boolean;
}

// ============================================================================
// HOOK: useAIChat - Manage conversation list
// ============================================================================

export interface UseAIChatResult {
  conversations: ChatConversation[];
  isLoading: boolean;
  error: string | null;
  upgradeRequired: boolean;
  createConversation: (title?: string) => Promise<ChatConversation | null>;
  deleteConversation: (id: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
}

export function useAIChat(): UseAIChatResult {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const mountedRef = useRef(true);

  const fetchConversations = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchWithCSRF('/api/ai/chat/conversations');

      const data: ConversationsResponse = await response.json();

      if (!mountedRef.current) return;

      if (data.upgradeRequired) {
        setUpgradeRequired(true);
        setError(data.error || 'Professional subscription required');
        setConversations([]);
        return;
      }

      if (!data.success) {
        setError(data.error || 'Failed to load conversations');
        return;
      }

      setConversations(data.conversations);
      setUpgradeRequired(false);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const createConversation = useCallback(async (title?: string): Promise<ChatConversation | null> => {
    try {
      setError(null);

      const response = await fetchWithCSRF('/api/ai/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ title }),
      });

      const data: CreateConversationResponse = await response.json();

      if (data.upgradeRequired) {
        setUpgradeRequired(true);
        setError(data.error || 'Professional subscription required');
        return null;
      }

      if (!data.success) {
        setError(data.error || 'Failed to create conversation');
        return null;
      }

      // Add to list at the top (newest first)
      setConversations(prev => [data.conversation, ...prev]);
      return data.conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
      return null;
    }
  }, []);

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);

      const response = await fetchWithCSRF(`/api/ai/chat/conversations/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to delete conversation');
        return;
      }

      // Remove from list
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete conversation');
    }
  }, []);

  const archiveConversation = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);

      await fetchWithCSRF(`/api/ai/chat/conversations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      // Remove from active list (archived conversations are filtered out)
      setConversations(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to archive conversation');
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchConversations();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchConversations]);

  return {
    conversations,
    isLoading,
    error,
    upgradeRequired,
    createConversation,
    deleteConversation,
    archiveConversation,
    refreshConversations: fetchConversations,
  };
}

// ============================================================================
// HOOK: useAIChatConversation - Single conversation with streaming
// ============================================================================

export interface UseAIChatConversationResult {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  streamingContent: string;
  isStreaming: boolean;
  titleUpdated: boolean;
}

export function useAIChatConversation(
  conversationId: string | null,
  options?: { onTitleUpdated?: (title: string) => void }
): UseAIChatConversationResult {
  const [conversation, setConversation] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [titleUpdated, setTitleUpdated] = useState(false);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFirstMessageRef = useRef(true);

  // Fetch conversation and messages
  const fetchConversation = useCallback(async () => {
    if (!conversationId) {
      setConversation(null);
      setMessages([]);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetchWithCSRF(`/api/ai/chat/conversations/${conversationId}`);

      const data: ConversationResponse = await response.json();

      if (!mountedRef.current) return;

      if (!data.success) {
        setError(data.error || 'Failed to load conversation');
        return;
      }

      setConversation(data.conversation);
      setMessages(data.messages);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [conversationId]);

  // Send message with SSE streaming
  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!conversationId || !content.trim() || isStreaming) return;

    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setError(null);
      setIsStreaming(true);
      setStreamingContent('');

      // Optimistically add user message
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: content.trim(),
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Send request for SSE stream
      const response = await fetchWithCSRF(`/api/ai/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: content.trim() }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Process SSE stream
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream not available');
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let userMessageId: string | undefined;
      let assistantMessageId: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parse SSE events
          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim();

            // Read the next data line
            const dataLineIndex = lines.indexOf(line) + 1;
            if (dataLineIndex < lines.length && lines[dataLineIndex].startsWith('data:')) {
              const dataStr = lines[dataLineIndex].slice(5).trim();
              try {
                const data = JSON.parse(dataStr);

                if (eventType === 'message_start') {
                  userMessageId = data.userMessageId;
                  // Update temp user message with real ID
                  setMessages(prev =>
                    prev.map(m =>
                      m.id === userMessage.id ? { ...m, id: userMessageId! } : m
                    )
                  );
                } else if (eventType === 'message_complete') {
                  assistantMessageId = data.assistantMessageId;
                } else if (eventType === 'error') {
                  throw new Error(data.error || 'Stream error');
                }
              } catch {
                // Not JSON, skip
              }
            }
          } else if (line.startsWith('data:')) {
            const dataStr = line.slice(5).trim();
            try {
              const data = JSON.parse(dataStr);
              if (data.token) {
                fullContent += data.token;
                if (mountedRef.current) {
                  setStreamingContent(fullContent);
                }
              }
            } catch {
              // Not JSON, skip
            }
          }
        }
      }

      // Add assistant message to state
      if (mountedRef.current && fullContent) {
        const assistantMessage: ChatMessage = {
          id: assistantMessageId || `assistant-${Date.now()}`,
          role: 'assistant',
          content: fullContent,
          createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setStreamingContent('');

        // Auto-title: fire after first response completes (fire-and-forget)
        if (isFirstMessageRef.current && conversationId) {
          isFirstMessageRef.current = false;
          fetchWithCSRF(`/api/ai/chat/conversations/${conversationId}/auto-title`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          })
            .then((res) => res.json())
            .then((data) => {
              if (!mountedRef.current) return;
              if (data.success && !data.skipped && data.title) {
                // Title was freshly updated — sync it locally
                setConversation(prev => prev ? { ...prev, title: data.title } : null);
              }
              // Always refresh sidebar after first message — title may have been
              // updated inline by the messages route even if auto-title was skipped
              if (data.success) {
                setTitleUpdated(true);
                options?.onTitleUpdated?.(data.title ?? '');
              }
            })
            .catch(() => {
              // Non-blocking — title update failure is not a critical error
            });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Stream was aborted, don't show error
        return;
      }
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
        // Remove optimistic user message on error
        setMessages(prev => prev.filter(m => m.id !== `temp-${Date.now()}`));
      }
    } finally {
      if (mountedRef.current) {
        setIsStreaming(false);
        setStreamingContent('');
      }
    }
  }, [conversationId, isStreaming, conversation?.title]);

  // Fetch on mount or conversationId change; reset first-message tracker
  useEffect(() => {
    isFirstMessageRef.current = true;
    setTitleUpdated(false);
    fetchConversation();
  }, [fetchConversation]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    conversation,
    messages,
    isLoading,
    error,
    sendMessage,
    streamingContent,
    isStreaming,
    titleUpdated,
  };
}
