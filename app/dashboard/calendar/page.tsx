'use client';

/**
 * Content Calendar Dashboard Page
 *
 * @description Week view calendar with drag-drop scheduling, team filtering,
 * and post detail modal. Uses useCalendar hook for data management.
 */

import { useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCalendar, SchedulePostOptions } from '@/hooks/useCalendar';
import { useUser } from '@/hooks/use-user';
import { TimeSlotPicker } from '@/components/scheduling';
import { LiveModeReadinessCard } from '@/components/autonomous/LiveModeReadinessCard';
import { LiveModeActivationModal } from '@/components/autonomous/LiveModeActivationModal';
import { PerpeualReviewerNudge } from '@/components/autonomous/PerpeualReviewerNudge';

// Dynamic imports for heavy calendar components
const WeekView = dynamic(
  () =>
    import('@/components/calendar/WeekView').then(m => ({
      default: m.WeekView,
    })),
  { ssr: false }
);
const MonthView = dynamic(
  () =>
    import('@/components/calendar/MonthView').then(m => ({
      default: m.MonthView,
    })),
  { ssr: false }
);
const PostDetailModal = dynamic(
  () =>
    import('@/components/calendar/PostDetailModal').then(m => ({
      default: m.PostDetailModal,
    })),
  { ssr: false }
);
const AICalendarSection = dynamic(
  () =>
    import('@/components/calendar/AICalendarSection').then(m => ({
      default: m.AICalendarSection,
    })),
  { ssr: false }
);
import { PageHeader } from '@/components/dashboard/page-header';
import { DashboardEmptyState } from '@/components/dashboard/empty-state';
import { FIRST_WEEK_GUIDANCE } from '@/lib/dashboard/first-week-guidance';
import { pickNeedsYouItems } from '@/lib/dashboard/needs-you';
import { pickBestBusinessSlots } from '@/lib/dashboard/best-business-schedule';
import { useOptimalTimes } from '@/hooks/use-optimal-times';
import { BestScheduleDialog } from '@/components/calendar/BestScheduleDialog';
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
  Loader2,
  ListTodo,
  CalendarDays,
  Sparkles,
} from '@/components/icons';
import type { ScheduledPost } from '@/components/calendar/CalendarTypes';
import { customerPostStatus } from '@/lib/dashboard/post-status';

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

function CalendarPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useUser();
  const organizationId = user?.organizationId || '';

  // View mode state
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'queue'>('week');
  const [showAgencyTools, setShowAgencyTools] = useState(false);

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
  const [bestWeekOpen, setBestWeekOpen] = useState(false);

  // Live-mode readiness data (shared for nudge + card)
  const [activationModalOpen, setActivationModalOpen] = useState(false);
  const fetchJson = (url: string) =>
    fetch(url, { credentials: 'include' }).then(r => r.json());
  const { data: readinessData, mutate: mutateReadiness } = useSWR(
    '/api/calendar/live-mode-readiness',
    fetchJson,
    { refreshInterval: 60_000 }
  );

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

  const { slots: optimalSlots, isLoading: optimalLoading } = useOptimalTimes({
    platforms: ['instagram', 'facebook', 'linkedin', 'twitter'],
    enabled: Boolean(organizationId),
  });

  const recommendedKeys = useMemo(() => {
    return pickBestBusinessSlots({
      slots: optimalSlots,
      weekStart: currentStartDate,
      existing: posts.map(p => new Date(p.scheduledFor)),
      count: 5,
    }).map(slot => `${slot.at.toDateString()}-${slot.at.getHours()}`);
  }, [optimalSlots, currentStartDate, posts]);

  const upcoming = useMemo(
    () =>
      [...posts]
        .sort(
          (a, b) =>
            new Date(a.scheduledFor).getTime() -
            new Date(b.scheduledFor).getTime()
        )
        .slice(0, 8),
    [posts]
  );

  const needsYou = pickNeedsYouItems(
    posts.map(p => ({
      id: p.id,
      title: p.title,
      content: p.content,
      status: p.status,
      approvalStatus: p.approvalStatus,
    }))
  );

  // Check for action param to auto-open schedule modal
  useEffect(() => {
    if (searchParams.get('action') === 'schedule') {
      setIsScheduleModalOpen(true);
      setScheduleDate(new Date());
    }
    if (searchParams.get('view') === 'queue') {
      setViewMode('queue');
    }
  }, [searchParams]);

  // Fetch team members
  useEffect(() => {
    if (!organizationId) return;

    const fetchTeamMembers = async () => {
      try {
        const response = await fetch(
          `/api/team?organizationId=${organizationId}`
        );
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
    setScheduleForm(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platformId)
        ? prev.platforms.filter(p => p !== platformId)
        : [...prev.platforms, platformId],
    }));
  };

  // Handle schedule submit
  const handleScheduleSubmit = async () => {
    if (
      !scheduleDate ||
      !scheduleForm.content ||
      scheduleForm.platforms.length === 0
    ) {
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
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-gray-300">Loading calendar...</p>
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
          <h3 className="text-lg font-semibold text-white mb-2">
            Failed to Load Calendar
          </h3>
          <p className="text-gray-300 mb-4">{error}</p>
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
        eyebrow="Scheduler"
        title="Calendar"
        description="See the week. Drag to move. Book the hours that fit this business — nothing goes out until you say so."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBestWeekOpen(true)}
              className="border-white/15 bg-white/[0.03] text-white hover:bg-white/[0.07]"
            >
              <Sparkles className="h-4 w-4 mr-2 text-orange-400" />
              Best week
            </Button>
            <Button
              onClick={() => {
                setScheduleDate(new Date(Date.now() + 60 * 60 * 1000));
                setIsScheduleModalOpen(true);
              }}
              className="bg-orange-500 hover:bg-orange-400 text-black font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Schedule
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-md border border-white/10 bg-white/[0.03] p-0.5">
          {(
            [
              ['week', CalendarDays, 'Week'],
              ['month', Calendar, 'Month'],
              ['queue', ListTodo, 'Queue'],
            ] as const
          ).map(([mode, Icon, label]) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-xs tracking-wide transition-colors ${
                viewMode === mode
                  ? 'bg-orange-500/15 text-orange-400'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-white/40 tabular-nums">
            {stats.scheduledPosts} scheduled · {stats.publishedPosts} posted
            {stats.conflictCount > 0 ? ` · ${stats.conflictCount} clash` : ''}
          </p>
          {teamMembers.length > 0 && (
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-40 h-8 bg-transparent border-white/10 text-xs">
                <Users className="h-3.5 w-3.5 mr-1.5 text-white/40" />
                <SelectValue placeholder="Everyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                {teamMembers.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name || member.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className="h-8 border-white/10 bg-transparent text-white/70"
          >
            Today
          </Button>
        </div>
      </div>

      {needsYou.length > 0 && (
        <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-medium text-red-200">Needs you</p>
          <p className="mt-1 text-xs text-red-200/70">
            Failed posts did not go out. Waiting posts still need your look. Fix
            here, or reconnect the channel on Platforms.
          </p>
          <ul className="mt-2 space-y-1.5">
            {needsYou.map(item => {
              const post = posts.find(p => p.id === item.id);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-white/70 truncate">
                    {item.label}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 text-xs text-orange-400 hover:text-orange-300"
                    onClick={() => {
                      if (!post) return;
                      setSelectedPost(post);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    {item.reason === 'failed' ? 'Fix' : 'Review'}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            href="/dashboard/platforms"
            className="mt-2 inline-block text-xs text-white/45 hover:text-white/70"
          >
            If a channel failed, reconnect it on Platforms
          </Link>
        </div>
      )}

      {/* Perpetual-reviewer nudge banner (shown at 30/45/60 shadow posts, suppressed in live mode) */}
      {showAgencyTools && readinessData && (
        <PerpeualReviewerNudge
          shadowPostsReviewed={readinessData.shadowPostsReviewed}
          approvalRate={readinessData.approvalRate}
          nudgeDismissedAt={readinessData.nudgeDismissedAt}
          liveModeT={readinessData.liveModeT}
          onDismissed={() => mutateReadiness()}
          onActivate={() => setActivationModalOpen(true)}
        />
      )}

      <button
        type="button"
        onClick={() => setShowAgencyTools(v => !v)}
        className="self-start text-xs text-white/35 hover:text-white/55"
      >
        {showAgencyTools
          ? 'Hide extra calendar tools'
          : 'Show practice / live tools'}
      </button>

      {showAgencyTools && (
        <>
          {/* AI Weekly Calendar — shadow/live mode + slot review */}
          <AICalendarSection />

          {/* Live-mode readiness card (shadow mode only, disappears once tier 1 activated) */}
          <LiveModeReadinessCard
            onActivate={() => setActivationModalOpen(true)}
          />
        </>
      )}

      {/* Live-mode activation ceremony modal */}
      <LiveModeActivationModal
        open={activationModalOpen}
        onClose={() => setActivationModalOpen(false)}
        onActivated={() => {
          setActivationModalOpen(false);
          mutateReadiness();
        }}
        approvalRate={readinessData?.approvalRate}
        topCategory={readinessData?.topCategory}
      />

      {/* Calendar View — keep the grid even when this week is empty so they can page to a booked week */}
      {posts.length === 0 && !isLoading && (
        <DashboardEmptyState
          icon={Calendar}
          title="Nothing booked this week"
          description={`${FIRST_WEEK_GUIDANCE.calendar.empty} If you already booked another week, use the arrows.`}
          action={{
            label: FIRST_WEEK_GUIDANCE.calendar.nextLabel,
            onClick: () => {
              router.push('/dashboard/content');
            },
          }}
        />
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-4 items-start">
        <div className="min-h-[560px]">
          {viewMode === 'week' ? (
            <WeekView
              posts={posts}
              currentDate={currentStartDate}
              onPostClick={handlePostClick}
              onPostReschedule={handlePostReschedule}
              onPostCreate={handlePostCreate}
              onWeekChange={handleWeekChange}
              recommendedKeys={recommendedKeys}
            />
          ) : viewMode === 'month' ? (
            <MonthView
              posts={posts}
              currentDate={currentStartDate}
              onPostClick={handlePostClick}
              onPostReschedule={handlePostReschedule}
              onPostCreate={handlePostCreate}
              onMonthChange={handleMonthChange}
            />
          ) : (
            <ul className="space-y-2">
              {posts.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handlePostClick(p)}
                    className="w-full text-left rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-white/80 truncate">
                        {p.title || p.content.slice(0, 90)}
                      </span>
                      <span className="shrink-0 text-xs text-orange-400">
                        {customerPostStatus(p.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/40">
                      {p.platforms.join(', ')} ·{' '}
                      {new Date(p.scheduledFor).toLocaleString('en-AU')}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-white/35">
            Upcoming
          </p>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-white/45 leading-relaxed">
              Nothing booked in this range. Use Best week to pick quiet hours,
              then write the post.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {upcoming.map(p => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => handlePostClick(p)}
                    className="w-full text-left rounded-md px-2 py-2 hover:bg-white/[0.05]"
                  >
                    <p className="text-xs text-orange-400 tabular-nums">
                      {new Date(p.scheduledFor).toLocaleString('en-AU', {
                        weekday: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="mt-0.5 text-sm text-white/80 line-clamp-2">
                      {p.title || p.content}
                    </p>
                    <p className="mt-1 text-xs text-white/35 capitalize">
                      {p.platforms.join(' · ')} · {customerPostStatus(p.status)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <BestScheduleDialog
        open={bestWeekOpen}
        onOpenChange={setBestWeekOpen}
        slots={optimalSlots}
        weekStart={currentStartDate}
        existing={posts.map(p => new Date(p.scheduledFor))}
        isLoading={optimalLoading}
        onBookSlot={(at, platform) => {
          setScheduleDate(at);
          setScheduleForm(prev => ({
            ...prev,
            platforms: prev.platforms.length ? prev.platforms : [platform],
          }));
          setIsScheduleModalOpen(true);
        }}
      />

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
                onChange={e =>
                  setScheduleForm(prev => ({
                    ...prev,
                    content: e.target.value,
                  }))
                }
                className="min-h-[120px] bg-gray-800/50 border-white/10 text-white placeholder:text-gray-500"
              />
            </div>

            {/* Date & Time -- Smart Picker */}
            <TimeSlotPicker
              value={scheduleDate}
              onChange={setScheduleDate}
              platform={scheduleForm.platforms[0] || 'twitter'}
              platforms={
                scheduleForm.platforms.length > 0
                  ? scheduleForm.platforms
                  : undefined
              }
              minDate={new Date()}
              compact
            />

            {/* Platforms */}
            <div className="space-y-2">
              <Label className="text-gray-300">Platforms</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {PLATFORMS.map(platform => (
                  <label
                    key={platform.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-800/50 border border-white/10 cursor-pointer hover:bg-gray-800/70 transition-colors"
                  >
                    <Checkbox
                      checked={scheduleForm.platforms.includes(platform.id)}
                      onCheckedChange={() => handlePlatformToggle(platform.id)}
                    />
                    <span className="text-sm text-gray-300">
                      {platform.label}
                    </span>
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
                className="bg-orange-500 hover:bg-orange-600 text-white"
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

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarPageContent />
    </Suspense>
  );
}
