'use client';

import { Badge } from '@/components/ui/badge';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, isToday } from 'date-fns';
import { platformColors, timeSlots } from './constants';
import type { ScheduledPost } from './types';

interface TimelineViewProps {
  selectedDate: Date;
  getPostsForDate: (date: Date) => ScheduledPost[];
  onEditPost: (post: ScheduledPost) => void;
}

export function TimelineView({ selectedDate, getPostsForDate, onEditPost }: TimelineViewProps) {
  const weekStart = startOfWeek(selectedDate);
  const weekEnd = endOfWeek(selectedDate);
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <div className="space-y-4">
      {days.map(day => {
        const posts = getPostsForDate(day);

        return (
          <div key={day.toISOString()} className="border-l-2 border-cyan-500/30 pl-4">
            <h3 className="font-medium text-lg mb-3">
              {format(day, 'EEEE, MMM d')}
              {isToday(day) && (
                <Badge className="ml-2" variant="default">Today</Badge>
              )}
            </h3>
            <div className="grid grid-cols-24 gap-1 h-20 bg-white/5 rounded-lg p-2">
              {timeSlots.map(time => {
                const hour = parseInt(time.split(':')[0]);
                const postsAtTime = posts.filter(post =>
                  post.scheduledTime.getHours() === hour
                );

                return (
                  <div
                    key={time}
                    className="relative group"
                    style={{ gridColumn: `span 1` }}
                  >
                    {postsAtTime.map((post, index) => (
                      <div
                        key={post.id}
                        className={`
                          absolute w-full h-4 rounded
                          ${platformColors[post.platforms[0] as keyof typeof platformColors]}
                          opacity-80 hover:opacity-100 cursor-pointer
                        `}
                        style={{ top: `${index * 20}px` }}
                        onClick={() => onEditPost(post)}
                      />
                    ))}
                    <div className="absolute bottom-0 text-xs text-gray-600 invisible group-hover:visible">
                      {time}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
