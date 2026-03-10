'use client';

/**
 * Content Calendar Dashboard Page
 *
 * @description Week view calendar with drag-drop scheduling, team filtering,
 * and post detail modal. Uses useCalendar hook for data management.
 */

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useCalendar, SchedulePostOptions } from '@/hooks/useCalendar';
import { useUser } from '@/hooks/use-user';
import { TimeSlotPicker } from '@/components/scheduling';

// Dynamic imports for heavy calendar components
const WeekView = dynamic(() => import('@/components/calendar/WeekView').then(m => ({ default: m.WeekView })), { ssr: false });
const MonthView = dynamic(() => import('@/components/calendar/MonthView').then(m => ({ default: m.MonthView })), { ssr: false });
const PostDetailModal = dynamic(() => import('@/components/calendar/PostDetailModal').then(m => ({ default: m.PostDetailModal })), { ssr: false });
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Calendar,
  Plus,
  Users,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  ListTodo,
  CalendarDays,
} from '@/components/icons';
import type { ScheduledPost } from '@/components/calendar/CalendarTypes';

// Available platforms for scheduling
const PLATFORMS = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'twitter', label: 'X (Twitter)' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'reddit', label: 'Reddit' },
  { id: 'threads', label: 'Threads' },
];

interface TeamMember {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const { user } = useUser();
  const organizationId = user?.organizationId || '';

  // View mode state
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Team filter state
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Modal states
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState({
    content: '',
    platforms: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize calendar hook
  const {
    posts,
    conflicts,
    stats,
    currentStartDate,
    currentEndDate,
    isLoading,
    error,
    goToPreviousWeek,
    goToNextWeek,
    goToToday,
    reschedulePost,
    schedulePost,
    clearError,
  } = useCalendar({
    organizationId,
    userId: selectedUserId === 'all' ? undefined : selectedUserId,
  });

  // Check for action param to auto-open schedule modal
  useEffect(() => {
    if (searchParams.get('action') === 'schedule') {
      setIsScheduleModalOpen(true);
      setScheduleDate(new Date());
    }
  }, [searchParams]);

  // Fetch team members
  useEffect(() => {
    if (!organizationId) return;

    const fetchTeamMembers = async () => {
      try {
        const response = await fetch(`/api/team?organizationId=${organizationId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.members) {
            setTeamMembers(data.members);
          }
        }
      } catch (err) {
        console.error('Failed to fetch team members:', err);
      }
    };

    fetchTeamMembers();
  }, [organizationId]);

  // Handle post click
  const handlePostClick = useCallback((post: ScheduledPost) => {
    setSelectedPost(post);
    setIsDetailModalOpen(true);
  }, []);

  // Handle post reschedule (drag-drop)
  const handlePostReschedule = useCallback(
    async (postId: string, newTime: Date) => {
      await reschedulePost(postId, newTime);
    },
    [reschedulePost]
  );

  // Handle create post click (clicking on empty slot)
  const handlePostCreate = useCallback((date: Date, hour: number) => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    setScheduleDate(d);
    setIsScheduleModalOpen(true);
  }, []);

  // Handle week navigation
  const handleWeekChange = useCallback(
    (direction: 'prev' | 'next') => {
      if (direction === 'prev') {
        goToPreviousWeek();
      } else {
        goToNextWeek();
      }
    },
    [goToPreviousWeek, goToNextWeek]
  );

  // Handle month navigation (adjusts by ~4 weeks)
  const handleMonthChange = useCallback(
    (direction: 'prev' | 'next') => {
      // Navigate 4 weeks to approximate month change
      for (let i = 0; i < 4; i++) {
        if (direction === 'prev') {
          goToPreviousWeek();
        } else {
          goToNextWeek();
        }
      }
    },
    [goToPreviousWeek, goToNextWeek]
  );

  // Handle platform toggle in form
  const handlePlatformToggle = (platformId: string) => {
    setScheduleForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter((p) => p !== platformId)
        : [...prev.platforms, platformId],
    }));
  };

  // Handle schedule submit
  const handleScheduleSubmit = async () => {
    if (!scheduleDate || !scheduleForm.content || scheduleForm.platforms.length === 0) {
      return;
    }

    setIsSubmitting(true);

    const options: SchedulePostOptions = {
      content: scheduleForm.content,
      platforms: scheduleForm.platforms,
      scheduledFor: scheduleDate,
    };

    const result = await schedulePost(options);

    setIsSubmitting(false);

    if (result) {
      setIsScheduleModalOpen(false);
      setScheduleForm({ content: '', platforms: [] });
      setScheduleDate(null);
    }
  };

  // Close detail modal
  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedPost(null);
  };

  // Loading state
  if (isLoading && posts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          <p className="text-gray-400">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && posts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 max-w-md text-center">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Failed to Load Calendar</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <Button onClick={clearError} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-6 p-6">
      {/* Header */}
      <PageHeader
        title="Content Calendar"
        description="Schedule and manage your content across all platforms"
        actions={
          <div className="flex items-center gap-3">
            {/* View Switcher */}
            <div className="flex rounded-lg bg-gray-900/50 border border-white/10 p-0.5">
              <button
                onClick={() => setViewMode('week')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'week'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <CalendarDays className="h-4 w-4" />
                Week
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'month'
                    ? 'bg-cyan-500/20 text-cyan-400'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Calendar className="h-4 w-4" />
                Month
              </button>
            </div>

            {/* Team Filter */}
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-48 bg-gray-900/50 border-white/10">
                <Users className="h-4 w-4 mr-2 text-gray-400" />
                <SelectValue placeholder="All Members" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Members</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Today Button */}
            <Button variant="outline" onClick={goToToday} className="bg-gray-900/50 border-white/10">
              Today
            </Button>

            {/* Schedule Post CTA */}
            <Button
              onClick={() => {
                setScheduleDate(new Date(Date.now() + 60 * 60 * 1000));
                setIsScheduleModalOpen(true);
              }}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Schedule Post
            </Button>
          </div>
        }
      />

      {/* Stats Bar */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalPosts}</p>
              <p className="text-sm text-gray-400">Total Posts</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Clock className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.scheduledPosts}</p>
              <p className="text-sm text-gray-400">Scheduled</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.publishedPosts}</p>
              <p className="text-sm text-gray-400">Published</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <ListTodo className="h-5 w-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.pendingApprovals || 0}</p>
              <p className="text-sm text-gray-400">Pending Approvals</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 border border-white/10 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.conflictCount}</p>
              <p className="text-sm text-gray-400">Conflicts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      {posts.length === 0 && !isLoading ? (
        <DashboardEmptyState
          icon={Calendar}
          title="No posts scheduled"
          description="Start scheduling your content to see it appear on the calendar."
          action={{
            label: 'Schedule Post',
            onClick: () => {
              setScheduleDate(new Date(Date.now() + 60 * 60 * 1000));
              setIsScheduleModalOpen(true);
            },
          }}
        />
      ) : (
        <div className="flex-1 min-h-[600px]">
          {viewMode === 'week' ? (
            <WeekView
              posts={posts}
              currentDate={currentStartDate}
              onPostClick={handlePostClick}
              onPostReschedule={handlePostReschedule}
              onPostCreate={handlePostCreate}
              onWeekChange={handleWeekChange}
            />
          ) : (
            <MonthView
              posts={posts}
              currentDate={currentStartDate}
              onPostClick={handlePostClick}
              onPostReschedule={handlePostReschedule}
              onPostCreate={handlePostCreate}
              onMonthChange={handleMonthChange}
            />
          )}
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          isOpen={isDetailModalOpen}
          onClose={handleCloseDetailModal}
        />
      )}

      {/* Schedule Post Modal */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="bg-gray-900 border-white/10 max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-white">Schedule Post</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Content */}
            <div className="space-y-2">
              <Label htmlFor="content" className="text-gray-300">
                Content
              </Label>
              <Textarea
                id="content"
                placeholder="Write your post content..."
                value={scheduleForm.content}
                onChange={(e) =>
                  setScheduleForm((prev) => ({ ...prev, content: e.target.value }))
                }
                className="min-h-[120px] bg-gray-800/50 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>

            {/* Date & Time -- Smart Picker */}
            <TimeSlotPicker
              value={scheduleDate}
              onChange={setScheduleDate}
              platform={scheduleForm.platforms[0] || 'twitter'}
              platforms={scheduleForm.platforms.length > 0 ? scheduleForm.platforms : undefined}
              minDate={new Date()}
              compact
            />

            {/* Platforms */}
            <div className="space-y-2">
              <Label className="text-gray-300">Platforms</Label>
              <div className="grid grid-cols-3 gap-2">
                {PLATFORMS.map((platform) => (
                  <label
                    key={platform.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 border border-white/10 cursor-pointer hover:bg-gray-800/70 transition-colors"
                  >
                    <Checkbox
                      checked={scheduleForm.platforms.includes(platform.id)}
                      onCheckedChange={() => handlePlatformToggle(platform.id)}
                    />
                    <span className="text-sm text-gray-300">{platform.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsScheduleModalOpen(false)}
                className="border-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handleScheduleSubmit}
                disabled={
                  isSubmitting ||
                  !scheduleForm.content ||
                  scheduleForm.platforms.length === 0
                }
                className="bg-cyan-500 hover:bg-cyan-600 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule Post'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
