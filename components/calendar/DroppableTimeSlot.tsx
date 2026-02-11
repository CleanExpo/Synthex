'use client';

/**
 * Droppable Time Slot Component
 *
 * A droppable area in the calendar that accepts dragged posts.
 * Highlights when a post is being dragged over it.
 */

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ScheduledPost, OPTIMAL_TIMES } from './CalendarTypes';
import { DraggablePostCard } from './DraggablePostCard';
import { Plus, Sparkles } from '@/components/icons';

interface DroppableTimeSlotProps {
  id: string;
  hour: number;
  date: Date;
  posts: ScheduledPost[];
  isOptimal?: boolean;
  platform?: string;
  onPostClick?: (post: ScheduledPost) => void;
  onCreateClick?: () => void;
  showHourLabel?: boolean;
  compact?: boolean;
}

export function DroppableTimeSlot({
  id,
  hour,
  date,
  posts,
  isOptimal = false,
  platform,
  onPostClick,
  onCreateClick,
  showHourLabel = true,
  compact = false,
}: DroppableTimeSlotProps) {
  const { isOver, setNodeRef, active } = useDroppable({
    id,
    data: { hour, date },
  });

  // Check if this slot is optimal for the dragged post's platform
  const draggedPost = active?.data?.current?.post as ScheduledPost | undefined;
  const isOptimalForDrag = draggedPost?.platforms.some(p =>
    OPTIMAL_TIMES[p]?.includes(hour)
  );

  const formatHour = (h: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h % 12 || 12;
    return `${displayHour}:00 ${period}`;
  };

  const isCurrentHour = () => {
    const now = new Date();
    return (
      now.getHours() === hour &&
      now.toDateString() === date.toDateString()
    );
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        group relative min-h-[80px] p-2 border-b border-white/5
        transition-all duration-200
        ${isOver ? 'bg-cyan-500/20 ring-2 ring-cyan-500 ring-inset' : ''}
        ${isOptimalForDrag && active ? 'bg-green-500/10' : ''}
        ${isCurrentHour() ? 'bg-cyan-500/5' : ''}
        ${compact ? 'min-h-[60px] p-1' : ''}
      `}
    >
      {/* Hour Label */}
      {showHourLabel && (
        <div className={`
          absolute left-0 top-0 w-16 h-full flex items-start justify-end pr-2 pt-2
          text-xs text-gray-500 border-r border-white/5
          ${isCurrentHour() ? 'text-cyan-400 font-medium' : ''}
        `}>
          {formatHour(hour)}
        </div>
      )}

      {/* Slot Content */}
      <div className={`
        ${showHourLabel ? 'ml-16 pl-2' : ''}
        h-full
      `}>
        {/* Optimal Time Indicator */}
        {isOptimal && !active && (
          <div className="absolute top-1 right-1 flex items-center gap-1 text-[10px] text-yellow-500">
            <Sparkles className="h-3 w-3" />
            <span>Optimal</span>
          </div>
        )}

        {/* Drop Zone Feedback */}
        {isOver && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-cyan-500/30 backdrop-blur-sm rounded-lg px-4 py-2 text-sm text-cyan-200">
              Drop to reschedule to {formatHour(hour)}
            </div>
          </div>
        )}

        {/* Optimal for Drag Feedback */}
        {isOptimalForDrag && active && !isOver && (
          <div className="absolute top-1 right-1 flex items-center gap-1 text-[10px] text-green-400">
            <Sparkles className="h-3 w-3" />
            <span>Recommended</span>
          </div>
        )}

        {/* Posts */}
        <div className={`space-y-1 ${compact ? 'space-y-0.5' : ''}`}>
          {posts.map((post) => (
            <DraggablePostCard
              key={post.id}
              post={post}
              onClick={() => onPostClick?.(post)}
              compact={compact}
            />
          ))}
        </div>

        {/* Add Button (visible on hover when empty) */}
        {posts.length === 0 && !active && (
          <button
            onClick={onCreateClick}
            className={`
              absolute inset-0 flex items-center justify-center
              opacity-0 group-hover:opacity-100 transition-opacity
              bg-white/5 hover:bg-white/10 rounded
            `}
          >
            <div className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
              <Plus className="h-4 w-4" />
              <span>Schedule post</span>
            </div>
          </button>
        )}
      </div>

      {/* Current Time Indicator */}
      {isCurrentHour() && (
        <div className="absolute left-0 right-0 h-0.5 bg-cyan-500 pointer-events-none"
          style={{
            top: `${(new Date().getMinutes() / 60) * 100}%`,
          }}
        >
          <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-cyan-500" />
        </div>
      )}
    </div>
  );
}

export default DroppableTimeSlot;
