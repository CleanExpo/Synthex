'use client';

/**
 * Draggable Post Card Component
 *
 * A draggable card representing a scheduled post in the calendar.
 * Uses @dnd-kit for drag-and-drop functionality.
 */

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { ScheduledPost, PLATFORM_COLORS } from './CalendarTypes';
import {
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  GripVertical,
} from '@/components/icons';

const platformIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

interface DraggablePostCardProps {
  post: ScheduledPost;
  onClick?: () => void;
  compact?: boolean;
  disabled?: boolean;
}

export function DraggablePostCard({
  post,
  onClick,
  compact = false,
  disabled = false,
}: DraggablePostCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: post.id,
    data: { type: 'post', post },
    disabled,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: disabled ? 'default' : 'grab',
  };

  const statusColors = {
    draft: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    scheduled: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    published: 'bg-green-500/20 text-green-300 border-green-500/30',
    failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  const StatusIcon = {
    draft: Clock,
    scheduled: Clock,
    published: CheckCircle,
    failed: XCircle,
  }[post.status];

  // Get primary platform for color
  const primaryPlatform = post.platforms[0] || 'twitter';
  const platformColor = PLATFORM_COLORS[primaryPlatform] || '#8B5CF6';
  const PrimaryIcon = platformIcons[primaryPlatform];

  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onClick}
        className={`
          group relative flex items-center gap-1.5 p-1.5 rounded-md text-xs
          transition-all duration-200 border
          ${statusColors[post.status]}
          ${isDragging ? 'ring-2 ring-purple-500 shadow-lg z-50' : ''}
          ${post.conflict ? 'ring-1 ring-yellow-500/50' : ''}
          ${!disabled ? 'hover:scale-[1.02] hover:shadow-md' : ''}
        `}
      >
        {/* Drag Handle */}
        {!disabled && (
          <GripVertical className="h-3 w-3 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        )}

        {/* Platform Icon */}
        {PrimaryIcon && (
          <div
            className="p-1 rounded flex-shrink-0"
            style={{ backgroundColor: `${platformColor}20` }}
          >
            <PrimaryIcon
              className="h-3 w-3"
              style={{ color: platformColor }}
            />
          </div>
        )}

        {/* Content Preview */}
        <span className="truncate flex-1 text-white/80">
          {post.title || post.content.slice(0, 30)}
        </span>

        {/* Time */}
        <span className="text-gray-500 flex-shrink-0">
          {new Date(post.scheduledFor).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {/* Conflict Warning */}
        {post.conflict && (
          <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`
        group relative p-3 rounded-lg border transition-all duration-200
        ${statusColors[post.status]}
        ${isDragging ? 'ring-2 ring-purple-500 shadow-xl z-50' : ''}
        ${post.conflict ? 'ring-1 ring-yellow-500/50' : ''}
        ${!disabled ? 'hover:scale-[1.01] hover:shadow-lg cursor-pointer' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          {!disabled && (
            <GripVertical className="h-4 w-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}

          {/* Platform Icons */}
          <div className="flex -space-x-1">
            {post.platforms.slice(0, 3).map((platform) => {
              const Icon = platformIcons[platform];
              const color = PLATFORM_COLORS[platform];
              return Icon ? (
                <div
                  key={platform}
                  className="p-1.5 rounded-full border-2 border-gray-900"
                  style={{ backgroundColor: `${color}30` }}
                >
                  <Icon
                    className="h-3 w-3"
                    style={{ color }}
                  />
                </div>
              ) : null;
            })}
            {post.platforms.length > 3 && (
              <div className="p-1.5 rounded-full bg-gray-700 border-2 border-gray-900 text-xs text-gray-300">
                +{post.platforms.length - 3}
              </div>
            )}
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-1">
          <StatusIcon className="h-3 w-3" />
          <span className="text-xs capitalize">{post.status}</span>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-white/90 line-clamp-2 mb-2">
        {post.title || post.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          {new Date(post.scheduledFor).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>

        {post.engagement && (
          <span className="text-purple-400">
            Est. {post.engagement.estimated || 0}% engagement
          </span>
        )}
      </div>

      {/* Conflict Banner */}
      {post.conflict && (
        <div className={`
          mt-2 p-2 rounded text-xs flex items-center gap-2
          ${post.conflict.severity === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-yellow-500/20 text-yellow-300'}
        `}>
          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
          <span>{post.conflict.message}</span>
        </div>
      )}

      {/* Recurrence Indicator */}
      {post.recurrence && (
        <div className="absolute top-1 right-1 p-1 bg-blue-500/20 rounded">
          <span className="text-[10px] text-blue-300">↻</span>
        </div>
      )}
    </div>
  );
}

export default DraggablePostCard;
