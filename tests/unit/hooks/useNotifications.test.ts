/**
 * useNotifications Hook Tests
 *
 * @description Tests for the unified notifications hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock EventSource
class MockEventSource {
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 1;
  private eventListeners: Map<string, Function[]> = new Map();

  close = jest.fn(() => {
    this.readyState = 2;
  });

  addEventListener(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  triggerOpen() {
    this.onopen?.();
  }

  triggerMessage(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  triggerError() {
    this.onerror?.({} as Event);
  }
}

let mockEventSourceInstance: MockEventSource;

beforeEach(() => {
  mockEventSourceInstance = new MockEventSource();
  (global as any).EventSource = jest.fn(() => mockEventSourceInstance);
});

// Import after mocking
import { useNotifications } from '@/hooks/useNotifications';

describe('useNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ notifications: [], unreadCount: 0 }),
    });
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionMethod).toBe('none');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should provide all expected methods', () => {
      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      expect(typeof result.current.connect).toBe('function');
      expect(typeof result.current.disconnect).toBe('function');
      expect(typeof result.current.markAsRead).toBe('function');
      expect(typeof result.current.clearNotifications).toBe('function');
      expect(typeof result.current.refreshNotifications).toBe('function');
    });
  });

  describe('connection management', () => {
    it('should auto-connect when autoConnect is true', async () => {
      renderHook(() => useNotifications({ autoConnect: true }));

      // Should attempt to create EventSource
      await waitFor(() => {
        expect(global.EventSource).toHaveBeenCalled();
      });
    });

    it('should not auto-connect when autoConnect is false', () => {
      renderHook(() => useNotifications({ autoConnect: false }));

      expect(global.EventSource).not.toHaveBeenCalled();
    });

    it('should connect on manual connect call', async () => {
      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      act(() => {
        result.current.connect();
      });

      await waitFor(() => {
        expect(global.EventSource).toHaveBeenCalled();
      });
    });

    it('should disconnect and clean up', async () => {
      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      // Connect first
      act(() => {
        result.current.connect();
      });

      // Then disconnect
      act(() => {
        result.current.disconnect();
      });

      expect(mockEventSourceInstance.close).toHaveBeenCalled();
      expect(result.current.isConnected).toBe(false);
      expect(result.current.connectionMethod).toBe('none');
    });
  });

  describe('notification handling', () => {
    it('should clear notifications', () => {
      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      act(() => {
        result.current.clearNotifications();
      });

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
    });

    it('should refresh notifications from server', async () => {
      const mockNotifications = [
        {
          id: 'test-1',
          type: 'info',
          title: 'Test',
          message: 'Test message',
          priority: 'normal',
          createdAt: new Date().toISOString(),
          read: false,
        },
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          notifications: mockNotifications,
          unreadCount: 1,
        }),
      });

      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      await act(async () => {
        await result.current.refreshNotifications();
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.unreadCount).toBe(1);
    });
  });

  describe('mark as read', () => {
    it('should mark single notification as read', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      await act(async () => {
        await result.current.markAsRead('notification-id');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('notification-id'),
      }));
    });

    it('should mark all notifications as read', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      await act(async () => {
        await result.current.markAsRead('all');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/notifications', expect.objectContaining({
        method: 'PATCH',
        body: expect.stringContaining('"all"'),
      }));
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() =>
        useNotifications({ autoConnect: false })
      );

      await act(async () => {
        await result.current.refreshNotifications();
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('SSE URL construction', () => {
    it('should include types filter in SSE URL', async () => {
      renderHook(() =>
        useNotifications({
          autoConnect: true,
          types: ['info', 'error'],
        })
      );

      await waitFor(() => {
        expect(global.EventSource).toHaveBeenCalledWith(
          expect.stringContaining('types=info%2Cerror'),
          expect.any(Object)
        );
      });
    });

    it('should include minPriority filter in SSE URL', async () => {
      renderHook(() =>
        useNotifications({
          autoConnect: true,
          minPriority: 'high',
        })
      );

      await waitFor(() => {
        expect(global.EventSource).toHaveBeenCalledWith(
          expect.stringContaining('minPriority=high'),
          expect.any(Object)
        );
      });
    });
  });
});

describe('Notification types', () => {
  it('should export correct types', () => {
    // Type checking - these will fail TypeScript compilation if types are wrong
    const notification: import('@/hooks/useNotifications').Notification = {
      id: 'test',
      type: 'info',
      title: 'Test',
      message: 'Test message',
      priority: 'normal',
      createdAt: new Date(),
      read: false,
    };

    const connectionMethod: import('@/hooks/useNotifications').ConnectionMethod = 'sse';

    expect(notification).toBeDefined();
    expect(connectionMethod).toBe('sse');
  });
});
