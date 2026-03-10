'use client';

/**
 * Connection Status Component
 *
 * Visual indicator for real-time connection status.
 * Shows WebSocket/SSE/Polling state with automatic reconnection.
 */

import React from 'react';
import { Wifi, WifiOff, Loader2, RefreshCw } from '@/components/icons';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';
export type ConnectionMethod = 'websocket' | 'sse' | 'polling' | 'none';

interface ConnectionStatusProps {
  state: ConnectionState;
  method?: ConnectionMethod;
  showLabel?: boolean;
  showMethod?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onReconnect?: () => void;
  className?: string;
}

const stateConfig = {
  connected: {
    color: 'text-green-400',
    bgColor: 'bg-green-400',
    label: 'Connected',
    pulse: true,
  },
  connecting: {
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400',
    label: 'Connecting...',
    pulse: false,
  },
  disconnected: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-400',
    label: 'Offline',
    pulse: false,
  },
  reconnecting: {
    color: 'text-orange-400',
    bgColor: 'bg-orange-400',
    label: 'Reconnecting...',
    pulse: false,
  },
};

const methodLabels: Record<ConnectionMethod, string> = {
  websocket: 'WebSocket',
  sse: 'Server Events',
  polling: 'Polling',
  none: 'None',
};

const sizeConfig = {
  sm: {
    dot: 'w-1.5 h-1.5',
    text: 'text-xs',
    icon: 'h-3 w-3',
    gap: 'gap-1',
  },
  md: {
    dot: 'w-2 h-2',
    text: 'text-sm',
    icon: 'h-4 w-4',
    gap: 'gap-1.5',
  },
  lg: {
    dot: 'w-2.5 h-2.5',
    text: 'text-base',
    icon: 'h-5 w-5',
    gap: 'gap-2',
  },
};

export function ConnectionStatus({
  state,
  method = 'none',
  showLabel = false,
  showMethod = false,
  size = 'md',
  onReconnect,
  className = '',
}: ConnectionStatusProps) {
  const config = stateConfig[state];
  const sizeClass = sizeConfig[size];

  return (
    <div
      className={`
        inline-flex items-center ${sizeClass.gap}
        ${className}
      `}
      title={`${config.label}${showMethod && method !== 'none' ? ` (${methodLabels[method]})` : ''}`}
    >
      {/* Status Indicator */}
      {state === 'connecting' || state === 'reconnecting' ? (
        <Loader2 className={`${sizeClass.icon} ${config.color} animate-spin`} />
      ) : state === 'connected' ? (
        <div className="relative">
          <span
            className={`
              block ${sizeClass.dot} rounded-full ${config.bgColor}
              ${config.pulse ? 'animate-pulse' : ''}
            `}
          />
          {config.pulse && (
            <span
              className={`
                absolute inset-0 ${sizeClass.dot} rounded-full ${config.bgColor}
                animate-ping opacity-75
              `}
            />
          )}
        </div>
      ) : (
        <span
          className={`
            block ${sizeClass.dot} rounded-full ${config.bgColor}
          `}
        />
      )}

      {/* Label */}
      {showLabel && (
        <span className={`${sizeClass.text} ${config.color}`}>
          {config.label}
        </span>
      )}

      {/* Method */}
      {showMethod && method !== 'none' && state === 'connected' && (
        <span className={`${sizeClass.text} text-gray-500`}>
          ({methodLabels[method]})
        </span>
      )}

      {/* Reconnect Button */}
      {state === 'disconnected' && onReconnect && (
        <button
          onClick={onReconnect}
          className={`
            p-1 rounded hover:bg-white/10 transition-colors
            ${config.color}
          `}
          aria-label="Reconnect to real-time service"
        >
          <RefreshCw className={sizeClass.icon} />
        </button>
      )}
    </div>
  );
}

/**
 * Floating Connection Status
 *
 * A floating indicator that can be positioned anywhere on the screen.
 */
export function FloatingConnectionStatus({
  state,
  method,
  position = 'bottom-right',
  onReconnect,
}: ConnectionStatusProps & {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  };

  // Only show when not connected
  if (state === 'connected') return null;

  return (
    <div
      className={`
        fixed ${positionClasses[position]} z-50
        bg-gray-900/90 backdrop-blur-sm rounded-lg px-3 py-2
        border border-white/10 shadow-lg
      `}
    >
      <ConnectionStatus
        state={state}
        method={method}
        showLabel
        size="sm"
        onReconnect={onReconnect}
      />
    </div>
  );
}

/**
 * Connection Status Badge
 *
 * A badge version for headers or navigation bars.
 */
export function ConnectionStatusBadge({
  state,
  method,
  onReconnect,
}: Omit<ConnectionStatusProps, 'showLabel' | 'showMethod' | 'size'>) {
  const config = stateConfig[state];

  return (
    <div
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full
        bg-white/5 border border-white/10
        ${config.color}
      `}
    >
      <ConnectionStatus
        state={state}
        method={method}
        size="sm"
        onReconnect={onReconnect}
      />
      <span className="text-xs">
        {state === 'connected'
          ? method === 'websocket'
            ? 'Real-time'
            : method === 'sse'
            ? 'Live'
            : 'Connected'
          : stateConfig[state].label}
      </span>
    </div>
  );
}

export default ConnectionStatus;
