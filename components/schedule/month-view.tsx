'use client';

/**
 * Month View Component
 * Calendar grid showing posts for the month
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from '@/components/icons';
import { getPlatformIconComponent } from './schedule-config';
import type { ScheduledPost } from './types';

interface MonthViewProps {
  posts: ScheduledPost[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onPostClick: (post: ScheduledPost) => void;
  onCreatePost: (date: Date, hour: number) => void;
}

export function MonthView({
  posts,
  currentDate,
  onDateChange,
  onPostClick,
  onCreatePost,
}: MonthViewProps) {
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
    onDateChange(newDate);
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const getPostsForDate = (date: Date | null) => {
    if (!date) return [];
    return posts.filter(post => {
      const postDate = new Date(post.scheduledFor);
      return postDate.toDateString() === date.toDateString();
    });
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigateMonth('prev')}
              className="text-slate-400"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDateChange(new Date())}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10"
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => navigateMonth('next')}
              className="text-slate-400"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-px bg-white/10 rounded-lg overflow-hidden">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-slate-900 p-2 text-center text-xs font-medium text-slate-400">
              {day}
            </div>
          ))}

          {getDaysInMonth(currentDate).map((date, index) => {
            const postsForDay = date ? getPostsForDate(date) : [];
            const isToday = date && date.toDateString() === new Date().toDateString();

            return (
              <div
                key={index}
                className={`bg-slate-900 min-h-[100px] p-2 ${
                  date ? 'hover:bg-white/5 cursor-pointer' : ''
                } ${isToday ? 'ring-1 ring-cyan-500' : ''}`}
                onClick={() => date && onCreatePost(date, 12)}
              >
                {date && (
                  <>
                    <div className={`text-sm mb-1 ${isToday ? 'text-cyan-400 font-bold' : 'text-slate-400'}`}>
                      {date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {postsForDay.slice(0, 3).map(post => {
                        const IconComponent = getPlatformIconComponent(post.platforms[0]);
                        return (
                          <div
                            key={post.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onPostClick(post);
                            }}
                            className={`text-xs p-1 rounded flex items-center space-x-1 cursor-pointer hover:scale-[1.02] transition-transform ${
                              post.status === 'published'
                                ? 'bg-green-500/20 text-green-300'
                                : 'bg-cyan-500/20 text-cyan-300'
                            }`}
                          >
                            {IconComponent && <IconComponent className="h-4 w-4" />}
                            <span className="truncate flex-1">{post.content.slice(0, 20)}...</span>
                          </div>
                        );
                      })}
                      {postsForDay.length > 3 && (
                        <div className="text-xs text-slate-500 text-center">
                          +{postsForDay.length - 3} more
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
