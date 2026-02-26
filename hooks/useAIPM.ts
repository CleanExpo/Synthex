/**
 * useAIPM — React hook for AI Project Manager state management
 *
 * Manages conversations, message sending, SSE stream consumption,
 * and optimistic updates for the AI PM chat interface.
 */

'use client';

import { useState, useCallback, useRef } from 'react';
import { fetchWithCSRF } from '@/lib/csrf';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actionItems?: Array<{
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  suggestions?: Array<{
    type: string;
    title: string;
    description: string;
    actionUrl?: string;
  }>;
  rating?: number;
  isStreaming?: boolean;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PMSuggestion {
  type: string;
  title: string;
  description: string;
  actionUrl?: string;
}

interface UseAIPMReturn {
  // State
  conversations: AIConversation[];
  activeConversation: AIConversation | null;
  messages: AIMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  greeting: string;
  dashboardSuggestions: PMSuggestion[];

  // Actions
  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<string | null>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  rateMessage: (messageId: string, rating: number) => Promise<void>;
  loadDashboardSuggestions: () => Promise<void>;
  clearError: () => void;
}

export function useAIPM(): UseAIPMReturn {
  const [conversations, setConversations] = useState<AIConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('');
  const [dashboardSuggestions, setDashboardSuggestions] = useState<PMSuggestion[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Fetch all conversations for the current user
   */
  const loadConversations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/pm/conversations', {
        credentials: 'include',
      });
      // Silently handle auth failures
      if (res.status === 401 || res.status === 403) {
        setIsLoading(false);
        return;
      }
      const data = await res.json();

      if (data.success) {
        setConversations(data.conversations);
      } else if (data.upgradeRequired) {
        setError('upgrade_required');
      } else {
        setError(data.error || 'Failed to load conversations');
      }
    } catch (err) {
      setError('Network error loading conversations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Create a new conversation and return its ID
   */
  const createConversation = useCallback(async (title?: string): Promise<string | null> => {
    try {
      const res = await fetchWithCSRF('/api/ai/pm/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: title || 'New Conversation' }),
      });
      const data = await res.json();

      if (data.success && data.conversation) {
        const conv = data.conversation;
        setConversations((prev) => [conv, ...prev]);
        setActiveConversation(conv);
        setMessages([]);
        return conv.id;
      }
      return null;
    } catch {
      setError('Failed to create conversation');
      return null;
    }
  }, []);

  /**
   * Select and load messages for a conversation
   */
  const selectConversation = useCallback(async (conversationId: string) => {
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      setActiveConversation(conv);
    }

    setIsLoading(true);
    setMessages([]);
    // For now, messages are loaded from the streaming response
    // In production, we'd have a GET endpoint for message history
    setIsLoading(false);
  }, [conversations]);

  /**
   * Send a message and stream the AI response via SSE
   */
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isSending) return;

    let conversationId: string | null = activeConversation?.id || null;

    // Auto-create conversation if none active
    if (!conversationId) {
      conversationId = await createConversation(message.substring(0, 80));
      if (!conversationId) return;
    }

    setIsSending(true);
    setError(null);

    // Optimistic: add user message immediately
    const optimisticUserMsg: AIMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: message,
      createdAt: new Date().toISOString(),
    };

    // Optimistic: add empty assistant message for streaming
    const optimisticAssistantMsg: AIMessage = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      isStreaming: true,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUserMsg, optimisticAssistantMsg]);

    try {
      // Cancel previous stream if any
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const res = await fetchWithCSRF(`/api/ai/pm/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            try {
              const data = JSON.parse(dataStr);

              if (eventType === 'message_start') {
                // Update user message with real ID
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === optimisticUserMsg.id
                      ? { ...m, id: data.userMessageId }
                      : m
                  )
                );
              } else if (data.token) {
                // Streaming token — append to assistant message
                fullContent += data.token;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === optimisticAssistantMsg.id
                      ? { ...m, content: fullContent }
                      : m
                  )
                );
              } else if (eventType === 'message_complete') {
                // Stream complete — update with final data
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === optimisticAssistantMsg.id
                      ? {
                          ...m,
                          id: data.assistantMessageId,
                          isStreaming: false,
                          actionItems: data.actionItems,
                          suggestions: data.suggestions,
                        }
                      : m
                  )
                );
              } else if (eventType === 'error') {
                setError(data.error || 'Stream error');
              }
            } catch {
              // Skip malformed JSON
            }
            eventType = '';
          }
        }
      }

      // Update conversation in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                messageCount: c.messageCount + 2,
                lastMessageAt: new Date().toISOString(),
                title: c.title === 'New Conversation'
                  ? message.substring(0, 80)
                  : c.title,
              }
            : c
        )
      );
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('PM send error:', err);
      setError(err.message || 'Failed to send message');

      // Remove optimistic assistant message on error
      setMessages((prev) =>
        prev.filter((m) => m.id !== optimisticAssistantMsg.id)
      );
    } finally {
      setIsSending(false);
    }
  }, [activeConversation, isSending, createConversation]);

  /**
   * Rate an AI message (thumbs up/down)
   */
  const rateMessage = useCallback(async (messageId: string, rating: number) => {
    try {
      await fetchWithCSRF('/api/ai/pm/feedback', {
        method: 'POST',
        body: JSON.stringify({ messageId, rating }),
      });

      // Optimistic update
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, rating } : m))
      );
    } catch {
      // Non-critical — silently fail
    }
  }, []);

  /**
   * Load dashboard greeting and suggestions
   */
  const loadDashboardSuggestions = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/pm/suggestions', {
        credentials: 'include',
      });
      // Silently skip auth/permission errors — don't parse the body
      if (!res.ok) return;
      const data = await res.json();

      if (data.success) {
        setGreeting(data.greeting || '');
        setDashboardSuggestions(data.suggestions || []);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    conversations,
    activeConversation,
    messages,
    isLoading,
    isSending,
    error,
    greeting,
    dashboardSuggestions,
    loadConversations,
    createConversation,
    selectConversation,
    sendMessage,
    rateMessage,
    loadDashboardSuggestions,
    clearError,
  };
}
