'use client';

/**
 * Week View Calendar Component
 *
 * A 7-day calendar view with hourly time slots for scheduling posts.
 * Supports drag-and-drop rescheduling using @dnd-kit.
 */

import React, { useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import { DroppableTimeSlot } from './DroppableTimeSlot';
import { DraggablePostCard } from './DraggablePostCard';
import { ScheduledPost, OPTIMAL_TIMES, CalendarViewProps } from './CalendarTypes';
import { ChevronLeft, ChevronRight } from '@/components/icons';

interface WeekViewProps extends CalendarViewProps {
  onWeekChange?: (direction: 'prev' | 'next') => void;
  startHour?: number;
  endHour?: number;
}

export function WeekView({
  posts,
  currentDate,
  onPostClick,
  onPostReschedule,
  onPostCreate,
  optimalTimes = OPTIMAL_TIMES,
  onWeekChange,
  startHour = 6,
  endHour = 22,
}: WeekViewProps) {
  const [activePost, setActivePost] = React.useState<ScheduledPost | null>(null);

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

  // Get the week's dates starting from Sunday
  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      dates.push(date);
    }
    return dates;
  }, [currentDate]);

  // Hours to display
  const hours = useMemo(() => {
    const h: number[] = [];
    for (let i = startHour; i <= endHour; i++) {
      h.push(i);
    }
    return h;
  }, [startHour, endHour]);

  // Group posts by date and hour
  const postsBySlot = useMemo(() => {
    const grouped: Record<string, ScheduledPost[]> = {};

    posts.forEach((post) => {
      const postDate = new Date(post.scheduledFor);
      const dateKey = postDate.toDateString();
      const hour = postDate.getHours();
      const slotKey = `${dateKey}-${hour}`;

      if (!grouped[slotKey]) {
        grouped[slotKey] = [];
      }
      grouped[slotKey].push(post);
    });

    return grouped;
  }, [posts]);

  // Check if a slot is optimal for any platform
  const isOptimalSlot = (hour: number): boolean => {
    return Object.values(optimalTimes).some((times) => times.includes(hour));
  };

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
    const dropData = over.data.current as { hour: number; date: Date } | undefined;

    if (!dropData) return;

    // Create new scheduled time
    const newTime = new Date(dropData.date);
    newTime.setHours(dropData.hour, 0, 0, 0);

    // Only reschedule if time changed
    if (newTime.getTime() !== new Date(post.scheduledFor).getTime()) {
      onPostReschedule?.(post.id, newTime);
    }
  };

  const formatDayHeader = (date: Date) => {
    const isToday = date.toDateString() === new Date().toDateString();
    return (
      <div className={`text-center py-3 ${isToday ? 'bg-purple-500/10' : ''}`}>
        <div className="text-xs text-gray-500 uppercase">
          {date.toLocaleDateString('en-US', { weekday: 'short' })}
        </div>
        <div
          className={`text-lg font-semibold ${
            isToday ? 'text-purple-400' : 'text-white'
          }`}
        >
          {date.getDate()}
        </div>
        {isToday && (
          <div className="text-[10px] text-purple-400 font-medium">Today</div>
        )}
      </div>
    );
  };

  // Week range display
  const weekRangeDisplay = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const sameMonth = start.getMonth() === end.getMonth();

    if (sameMonth) {
      return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()} - ${end.getDate()}, ${start.getFullYear()}`;
    }
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${end.getFullYear()}`;
  }, [weekDates]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-full bg-gray-900/50 rounded-xl border border-white/10 overflow-hidden">
        {/* Header with navigation */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-gray-900/80">
          <button
            onClick={() => onWeekChange?.('prev')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h2 className="text-lg font-semibold text-white">{weekRangeDisplay}</h2>
          <button
            onClick={() => onWeekChange?.('next')}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-8 sticky top-0 z-10 bg-gray-900 border-b border-white/10">
            {/* Time column header */}
            <div className="w-16 border-r border-white/10" />

            {/* Day headers */}
            {weekDates.map((date) => (
              <div
                key={date.toISOString()}
                className="border-r border-white/5 last:border-r-0"
              >
                {formatDayHeader(date)}
              </div>
            ))}
          </div>

          {/* Time slots */}
          <div className="relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-8 border-b border-white/5 last:border-b-0"
              >
                {/* Hour label */}
                <div className="w-16 flex items-start justify-end pr-2 pt-2 text-xs text-gray-500 border-r border-white/10">
                  {hour % 12 || 12}:00 {hour >= 12 ? 'PM' : 'AM'}
                </div>

                {/* Day slots */}
                {weekDates.map((date) => {
                  const slotKey = `${date.toDateString()}-${hour}`;
                  const slotId = `slot-${date.toISOString()}-${hour}`;
                  const slotPosts = postsBySlot[slotKey] || [];

                  return (
                    <DroppableTimeSlot
                      key={slotId}
                      id={slotId}
                      hour={hour}
                      date={date}
                      posts={slotPosts}
                      isOptimal={isOptimalSlot(hour)}
                      onPostClick={onPostClick}
                      onCreateClick={() => onPostCreate?.(date, hour)}
                      showHourLabel={false}
                      compact
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activePost && (
          <div className="opacity-90 pointer-events-none">
            <DraggablePostCard post={activePost} compact disabled />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

export default WeekView;
