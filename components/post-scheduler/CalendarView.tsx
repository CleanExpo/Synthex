'use client';

import { Badge } from '@/components/ui/badge';
import { Globe } from '@/components/icons';
import { format, eachDayOfInterval, isSameDay, isToday, isPast, startOfMonth, endOfMonth } from 'date-fns';
import { platformIcons } from './constants';
import type { ScheduledPost } from './types';

interface CalendarViewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  getPostsForDate: (date: Date) => ScheduledPost[];
}

export function CalendarView({ selectedDate, onSelectDate, getPostsForDate }: CalendarViewProps) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="grid grid-cols-7 gap-2">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
        <div key={day} className="text-center text-sm font-medium text-gray-400 py-2">
          {day}
        </div>
      ))}
      {days.map(day => {
        const posts = getPostsForDate(day);
        const isSelected = isSameDay(day, selectedDate);
        const isPastDay = isPast(day) && !isToday(day);

        return (
          <div
            key={day.toISOString()}
            onClick={() => onSelectDate(day)}
            className={`
              min-h-[100px] p-2 rounded-lg border cursor-pointer transition-all
              ${isSelected ? 'border-cyan-500 bg-cyan-500/10' : 'border-white/10'}
              ${isToday(day) ? 'bg-blue-500/10' : ''}
              ${isPastDay ? 'opacity-50' : ''}
              hover:bg-white/5
            `}
          >
            <div className="flex justify-between items-start mb-1">
              <span className={`text-sm ${isToday(day) ? 'font-bold text-blue-400' : ''}`}>
                {format(day, 'd')}
              </span>
              {posts.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {posts.length}
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              {posts.slice(0, 3).map(post => (
                <div key={post.id} className="flex items-center gap-1">
                  {post.platforms.map(platform => {
                    const Icon = platformIcons[platform as keyof typeof platformIcons] || Globe;
                    return (
                      <Icon key={platform} className="w-3 h-3 text-gray-400" />
                    );
                  })}
                </div>
              ))}
              {posts.length > 3 && (
                <span className="text-xs text-gray-400">+{posts.length - 3} more</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
