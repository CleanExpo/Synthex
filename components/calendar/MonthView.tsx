'use client';

/**
 * Month View Calendar Component
 *
 * A monthly calendar view showing posts across a 4-6 week grid.
 * Supports drag-and-drop rescheduling using @dnd-kit.
 */

import React, { useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import { DraggablePostCard } from './DraggablePostCard';
import { ScheduledPost, CalendarViewProps, PLATFORM_COLORS } from './CalendarTypes';
import { ChevronLeft, ChevronRight, Plus } from '@/components/icons';

interface MonthViewProps extends CalendarViewProps {
  onMonthChange?: (direction: 'prev' | 'next') => void;
}

interface DroppableDayCellProps {
  date: Date;
  posts: ScheduledPost[];
  isToday: boolean;
  isCurrentMonth: boolean;
  onPostClick?: (post: ScheduledPost) => void;
  onCreateClick?: () => void;
}

function DroppableDayCell({
  date,
  posts,
  isToday,
  isCurrentMonth,
  onPostClick,
  onCreateClick,
}: DroppableDayCellProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${date.toISOString()}`,
    data: { date, hour: 12 }, // Default to noon when dropping on a day
  });

  const displayPosts = posts.slice(0, 3);
  const overflowCount = posts.length - 3;

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[100px] p-1.5 border-r border-b border-white/5
        transition-colors duration-150 group relative
        ${isCurrentMonth ? 'bg-gray-900/30' : 'bg-gray-900/10'}
        ${isOver ? 'bg-cyan-500/10 ring-1 ring-inset ring-cyan-500/30' : ''}
        ${isToday ? 'ring-1 ring-inset ring-cyan-500/50' : ''}
      `}
    >
      {/* Day Number */}
      <div className="flex items-center justify-between mb-1">
        <span
          className={`
            text-xs font-medium px-1.5 py-0.5 rounded-full
            ${isToday ? 'bg-cyan-500 text-white' : isCurrentMonth ? 'text-gray-300' : 'text-gray-600'}
          `}
        >
          {date.getDate()}
        </span>

        {/* Add button on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCreateClick?.();
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all"
        >
          <Plus className="h-3 w-3 text-gray-400" />
        </button>
      </div>

      {/* Posts */}
      <div className="space-y-1">
        {displayPosts.map((post) => (
          <div
            key={post.id}
            onClick={() => onPostClick?.(post)}
            className="cursor-pointer"
          >
            <DraggablePostCard post={post} compact />
          </div>
        ))}

        {/* Overflow indicator */}
        {overflowCount > 0 && (
          <div className="text-xs text-gray-400 px-1.5 py-0.5 hover:text-cyan-400 cursor-pointer transition-colors">
            +{overflowCount} more
          </div>
        )}
      </div>
    </div>
  );
}

export function MonthView({
  posts,
  currentDate,
  onPostClick,
  onPostReschedule,
  onPostCreate,
  onMonthChange,
}: MonthViewProps) {
  const [activePost, setActivePost] = useState<ScheduledPost | null>(null);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Get all days to display (6 weeks to ensure full month coverage)
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // First day of the month
    const firstDay = new Date(year, month, 1);
    // Start from the Sunday before (or the first if it's Sunday)
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }

    return days;
  }, [currentDate]);

  // Group posts by date
  const postsByDate = useMemo(() => {
    const grouped: Record<string, ScheduledPost[]> = {};

    posts.forEach((post) => {
      const postDate = new Date(post.scheduledFor);
      const dateKey = postDate.toDateString();

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(post);
    });

    // Sort posts within each day by time
    Object.keys(grouped).forEach((key) => {
      grouped[key].sort(
        (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
      );
    });

    return grouped;
  }, [posts]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const post = event.active.data.current?.post as ScheduledPost;
    setActivePost(post);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    setActivePost(null);

    const { active, over } = event;

    if (!over || !active.data.current?.post) return;

    const post = active.data.current.post as ScheduledPost;
    const dropData = over.data.current as { date: Date; hour: number } | undefined;

    if (!dropData) return;

    // Create new scheduled time (keep original time, change date)
    const originalDate = new Date(post.scheduledFor);
    const newTime = new Date(dropData.date);
    newTime.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

    // Only reschedule if date changed
    if (newTime.toDateString() !== originalDate.toDateString()) {
      onPostReschedule?.(post.id, newTime);
    }
  };

  // Month header text
  const monthYearText = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const today = new Date();
  const currentMonth = currentDate.getMonth();

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-gray-900/50 rounded-xl border border-white/10 overflow-hidden">
        {/* Header with navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gray-900/80">
          <button
            onClick={() => onMonthChange?.('prev')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-white">{monthYearText}</h2>
          <button
            onClick={() => onMonthChange?.('next')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Day of week headers */}
        <div className="grid grid-cols-7 border-b border-white/10 bg-gray-900/60">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dateKey = day.toDateString();
              const dayPosts = postsByDate[dateKey] || [];
              const isToday = day.toDateString() === today.toDateString();
              const isCurrentMonth = day.getMonth() === currentMonth;

              return (
                <DroppableDayCell
                  key={day.toISOString()}
                  date={day}
                  posts={dayPosts}
                  isToday={isToday}
                  isCurrentMonth={isCurrentMonth}
                  onPostClick={onPostClick}
                  onCreateClick={() => onPostCreate?.(day, 12)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activePost && (
          <div className="opacity-90 pointer-events-none w-48">
            <DraggablePostCard post={activePost} compact disabled />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default MonthView;
