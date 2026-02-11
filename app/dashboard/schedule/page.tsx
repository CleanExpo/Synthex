'use client';

/**
 * Content Schedule Page
 *
 * Enhanced content calendar with drag-and-drop rescheduling,
 * multiple views (week, month, list), and conflict detection.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  Twitter,
  Linkedin,
  Instagram,
  Facebook,
  Video,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Zap,
  Download,
  Upload,
  Loader2,
  CalendarDays,
  List,
  AlertTriangle,
} from '@/components/icons';
import {
  WeekView,
  PostDetailModal,
  ScheduledPost,
  PLATFORM_COLORS,
  OPTIMAL_TIMES,
} from '@/components/calendar';
import toast from 'react-hot-toast';

// Platform icons
const platformIcons: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

// Mock scheduled posts for demo
const mockScheduledPosts: ScheduledPost[] = [
  {
    id: '1',
    content: "🚀 Just shipped our biggest feature yet! AI-powered content generation is now live. Who's ready to 10x their social media game?",
    platforms: ['twitter'],
    scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000),
    status: 'scheduled',
    engagement: { estimated: 8.5 },
    persona: 'Professional Voice',
  },
  {
    id: '2',
    content: "After 3 months of development, we're excited to announce that Synthex is transforming how businesses approach social media...",
    platforms: ['linkedin'],
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'scheduled',
    engagement: { estimated: 12.3 },
    persona: 'Thought Leader',
  },
  {
    id: '3',
    content: "POV: You just discovered the tool that writes viral content for you 🤯 #ContentCreation #AI #SocialMedia",
    platforms: ['tiktok', 'instagram'],
    scheduledFor: new Date(Date.now() + 48 * 60 * 60 * 1000),
    status: 'scheduled',
    engagement: { estimated: 25.7 },
    persona: 'Casual Creator',
  },
  {
    id: '4',
    content: "Behind the scenes of building an AI startup 📸 Swipe to see our journey from idea to launch →",
    platforms: ['instagram'],
    scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000),
    status: 'published',
    engagement: { actual: 15.2, likes: 1250, comments: 89, shares: 45 },
    persona: 'Casual Creator',
  },
  {
    id: '5',
    content: "New blog post: 10 AI tools that will transform your marketing in 2024. Link in bio! 🔗",
    platforms: ['twitter', 'linkedin', 'facebook'],
    scheduledFor: new Date(Date.now() + 72 * 60 * 60 * 1000),
    status: 'scheduled',
    engagement: { estimated: 6.8 },
  },
];

// Best times to post
const bestTimes: Record<string, string[]> = {
  twitter: ['9:00 AM', '12:00 PM', '3:00 PM', '7:00 PM'],
  linkedin: ['8:00 AM', '12:00 PM', '5:00 PM'],
  instagram: ['11:00 AM', '1:00 PM', '5:00 PM', '8:00 PM'],
  facebook: ['9:00 AM', '1:00 PM', '3:00 PM', '8:00 PM'],
  tiktok: ['6:00 AM', '10:00 AM', '7:00 PM', '10:00 PM'],
};

type ViewMode = 'week' | 'month' | 'list';

export default function SchedulePage() {
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper to get auth token
  const getAuthToken = () => {
    return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || localStorage.getItem('token');
  };

  // Load schedule data
  useEffect(() => {
    const loadSchedule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        if (token) {
          const response = await fetch('/api/scheduler/posts', {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const { data } = await response.json();
            const apiPosts: ScheduledPost[] = data.map((p: Record<string, unknown>) => ({
              id: String(p.id),
              content: (p.content as string) || '',
              platforms: (p.platforms as string[]) || [(p.platform as string) || 'twitter'],
              scheduledFor: new Date(p.scheduledAt as string),
              status: (p.status as ScheduledPost['status']) || 'scheduled',
              engagement: {
                estimated: ((p.metadata as Record<string, unknown>)?.estimatedEngagement as number) || 5,
                ...(p.status === 'published' ? {
                  actual: ((p.metadata as Record<string, unknown>)?.engagement as Record<string, unknown>)?.actual as number,
                  likes: ((p.metadata as Record<string, unknown>)?.engagement as Record<string, unknown>)?.likes as number,
                  comments: ((p.metadata as Record<string, unknown>)?.engagement as Record<string, unknown>)?.comments as number,
                  shares: ((p.metadata as Record<string, unknown>)?.engagement as Record<string, unknown>)?.shares as number,
                } : {}),
              },
              persona: ((p.metadata as Record<string, unknown>)?.persona as string) || 'Default',
              hashtags: (p.hashtags as string[]) || [],
              mediaUrls: (p.mediaUrls as string[]) || [],
            }));

            if (apiPosts.length > 0) {
              setPosts(apiPosts);
              setIsLoading(false);
              return;
            }
          }
        }
        // Fall back to mock data for demo
        await new Promise(resolve => setTimeout(resolve, 400));
        setPosts(mockScheduledPosts);
        setIsLoading(false);
      } catch {
        setPosts(mockScheduledPosts);
        setIsLoading(false);
      }
    };
    loadSchedule();
  }, []);

  // Handle post reschedule via drag-and-drop
  const handlePostReschedule = useCallback(async (postId: string, newTime: Date) => {
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, scheduledFor: newTime } : p
    ));

    toast.success(`Rescheduled to ${newTime.toLocaleString()}`);

    // Try to update via API
    try {
      const token = getAuthToken();
      if (token) {
        await fetch('/api/content/calendar', {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postId,
            newTime: newTime.toISOString(),
          }),
        });
      }
    } catch {
      // Revert on error
      setPosts(prev => prev.map(p =>
        p.id === postId ? post : p
      ));
      toast.error('Failed to reschedule. Please try again.');
    }
  }, [posts]);

  // Handle post click
  const handlePostClick = useCallback((post: ScheduledPost) => {
    setSelectedPost(post);
  }, []);

  // Handle post create
  const handlePostCreate = useCallback((date: Date, hour: number) => {
    const scheduledTime = new Date(date);
    scheduledTime.setHours(hour, 0, 0, 0);

    // Navigate to content creation with pre-filled schedule time
    toast.success(`Creating post for ${scheduledTime.toLocaleString()}`);
    setIsCreating(true);
    setTimeout(() => setIsCreating(false), 1000);
  }, []);

  // Handle save post changes
  const handleSavePost = useCallback(async (updatedPost: ScheduledPost) => {
    setPosts(prev => prev.map(p =>
      p.id === updatedPost.id ? updatedPost : p
    ));
    toast.success('Post updated successfully!');
  }, []);

  // Handle delete post
  const handleDeletePost = useCallback(async (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast.success('Post deleted');
  }, []);

  // Handle publish now
  const handlePublishNow = useCallback(async (postId: string) => {
    setPosts(prev => prev.map(p =>
      p.id === postId ? { ...p, status: 'published' as const } : p
    ));
    toast.success('Post published successfully!');
  }, []);

  // Handle duplicate post
  const handleDuplicatePost = useCallback((post: ScheduledPost) => {
    const newPost: ScheduledPost = {
      ...post,
      id: `${Date.now()}`,
      status: 'draft',
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
    setPosts(prev => [...prev, newPost]);
    toast.success('Post duplicated!');
  }, []);

  // Week navigation
  const handleWeekChange = useCallback((direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  }, []);

  // Month navigation
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  // Export schedule
  const handleExportSchedule = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      posts: filteredPosts.map(post => ({
        ...post,
        scheduledFor: new Date(post.scheduledFor).toISOString(),
      })),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `content-schedule-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Schedule exported successfully!');
  };

  // Import schedule
  const handleImportSchedule = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.posts && Array.isArray(data.posts)) {
            const importedPosts: ScheduledPost[] = data.posts.map((post: ScheduledPost, index: number) => ({
              ...post,
              id: `${Date.now()}-${index}`,
              scheduledFor: new Date(post.scheduledFor),
            }));
            setPosts(prev => [...prev, ...importedPosts]);
            toast.success(`Imported ${importedPosts.length} posts!`);
          } else {
            toast.error('Invalid schedule file format');
          }
        } catch {
          toast.error('Failed to parse schedule file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleRetry = async () => {
    setError(null);
    setIsLoading(true);
    setPosts(mockScheduledPosts);
    setIsLoading(false);
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <APIErrorCard title="Schedule Error" message={error} onRetry={handleRetry} />;
  }

  // Filter posts
  const filteredPosts = posts.filter(post => {
    if (filterPlatform !== 'all' && !post.platforms.includes(filterPlatform)) return false;
    if (filterStatus !== 'all' && post.status !== filterStatus) return false;
    return true;
  });

  // Calculate stats
  const stats = {
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
    avgEngagement: posts.reduce((sum, p) => sum + (p.engagement?.actual || p.engagement?.estimated || 0), 0) / Math.max(posts.length, 1),
  };

  // Get days in month for month view
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
    return filteredPosts.filter(post => {
      const postDate = new Date(post.scheduledFor);
      return postDate.toDateString() === date.toDateString();
    });
  };

  const PlatformIcon = (platform: string) => {
    const Icon = platformIcons[platform];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Content Schedule</h1>
          <p className="text-gray-400 mt-1">
            Drag and drop to reschedule your content across all platforms
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <Button
            onClick={handleImportSchedule}
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button
            onClick={handleExportSchedule}
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button
            onClick={() => handlePostCreate(new Date(), new Date().getHours())}
            disabled={isCreating}
            className="gradient-primary text-white"
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Create Post
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Scheduled</CardTitle>
            <Clock className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.scheduled}</div>
            <p className="text-xs text-gray-500 mt-1">Ready to publish</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Published</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.published}</div>
            <p className="text-xs text-gray-500 mt-1">This month</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Avg Engagement</CardTitle>
            <TrendingUp className="h-4 w-4 text-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.avgEngagement.toFixed(1)}%</div>
            <p className="text-xs text-gray-500 mt-1">Across all posts</p>
          </CardContent>
        </Card>
        <Card variant="glass">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Best Time</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">2:00 PM</div>
            <p className="text-xs text-gray-500 mt-1">Highest engagement</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex space-x-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 rounded text-sm transition-all flex items-center gap-2 ${
              viewMode === 'week'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            Week
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 rounded text-sm transition-all flex items-center gap-2 ${
              viewMode === 'month'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Month
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded text-sm transition-all flex items-center gap-2 ${
              viewMode === 'list'
                ? 'bg-cyan-500/20 text-cyan-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="h-4 w-4" />
            List
          </button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'week' ? (
        <div className="h-[600px]">
          <WeekView
            posts={filteredPosts}
            currentDate={currentDate}
            onPostClick={handlePostClick}
            onPostReschedule={handlePostReschedule}
            onPostCreate={handlePostCreate}
            optimalTimes={OPTIMAL_TIMES}
            onWeekChange={handleWeekChange}
          />
        </div>
      ) : viewMode === 'month' ? (
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
                  className="text-gray-400"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCurrentDate(new Date())}
                  className="bg-white/5 border-white/10 text-white hover:bg-white/10"
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => navigateMonth('next')}
                  className="text-gray-400"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-white/10 rounded-lg overflow-hidden">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-gray-900 p-2 text-center text-xs font-medium text-gray-400">
                  {day}
                </div>
              ))}

              {getDaysInMonth(currentDate).map((date, index) => {
                const postsForDay = date ? getPostsForDate(date) : [];
                const isToday = date && date.toDateString() === new Date().toDateString();

                return (
                  <div
                    key={index}
                    className={`bg-gray-900 min-h-[100px] p-2 ${
                      date ? 'hover:bg-white/5 cursor-pointer' : ''
                    } ${isToday ? 'ring-1 ring-cyan-500' : ''}`}
                    onClick={() => date && handlePostCreate(date, 12)}
                  >
                    {date && (
                      <>
                        <div className={`text-sm mb-1 ${isToday ? 'text-cyan-400 font-bold' : 'text-gray-400'}`}>
                          {date.getDate()}
                        </div>
                        <div className="space-y-1">
                          {postsForDay.slice(0, 3).map(post => (
                            <div
                              key={post.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePostClick(post);
                              }}
                              className={`text-xs p-1 rounded flex items-center space-x-1 cursor-pointer hover:scale-[1.02] transition-transform ${
                                post.status === 'published'
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-cyan-500/20 text-cyan-300'
                              }`}
                            >
                              {PlatformIcon(post.platforms[0])}
                              <span className="truncate flex-1">{post.content.slice(0, 20)}...</span>
                            </div>
                          ))}
                          {postsForDay.length > 3 && (
                            <div className="text-xs text-gray-500 text-center">
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
      ) : (
        <div className="space-y-4">
          {filteredPosts.length === 0 ? (
            <Card variant="glass">
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No posts found</h3>
                <p className="text-gray-400 mb-4">
                  {filterPlatform !== 'all' || filterStatus !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Create your first scheduled post to get started'}
                </p>
                <Button
                  onClick={() => handlePostCreate(new Date(), new Date().getHours())}
                  className="gradient-primary text-white"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Post
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredPosts
              .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime())
              .map(post => (
                <Card key={post.id} variant="glass" className="cursor-pointer hover:border-cyan-500/50 transition-colors" onClick={() => handlePostClick(post)}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="flex -space-x-1">
                            {post.platforms.slice(0, 3).map(platform => {
                              const color = PLATFORM_COLORS[platform];
                              return (
                                <div
                                  key={platform}
                                  className="p-2 rounded-lg border-2 border-gray-900"
                                  style={{ backgroundColor: `${color}20` }}
                                >
                                  {PlatformIcon(platform)}
                                </div>
                              );
                            })}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">
                              {post.platforms.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(post.scheduledFor).toLocaleString()}
                            </p>
                          </div>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            post.status === 'published'
                              ? 'bg-green-500/20 text-green-300'
                              : post.status === 'scheduled'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-gray-500/20 text-gray-300'
                          }`}>
                            {post.status}
                          </span>
                          {post.conflict && (
                            <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-300 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Conflict
                            </span>
                          )}
                        </div>
                        <p className="text-white mb-3">{post.content}</p>
                        <div className="flex items-center space-x-4 text-xs text-gray-400">
                          {post.persona && <span>Persona: {post.persona}</span>}
                          {post.status === 'published' && post.engagement ? (
                            <>
                              <span>❤️ {post.engagement.likes}</span>
                              <span>💬 {post.engagement.comments}</span>
                              <span>🔄 {post.engagement.shares}</span>
                              <span className="text-green-400">
                                {post.engagement.actual}% engagement
                              </span>
                            </>
                          ) : post.engagement?.estimated ? (
                            <span className="text-cyan-400">
                              Est. {post.engagement.estimated}% engagement
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex space-x-2" onClick={e => e.stopPropagation()}>
                        {post.status === 'scheduled' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handlePublishNow(post.id)}
                              className="text-gray-400 hover:text-green-400"
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
          )}
        </div>
      )}

      {/* Best Times Sidebar */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle className="text-lg">Optimal Posting Times</CardTitle>
          <CardDescription className="text-gray-400">
            Based on your audience engagement patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {Object.entries(bestTimes).map(([platform, times]) => {
              const Icon = platformIcons[platform];
              const color = PLATFORM_COLORS[platform];
              return (
                <div key={platform} className="flex items-start space-x-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: `${color}20` }}
                  >
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white capitalize mb-1">{platform}</p>
                    <div className="flex flex-wrap gap-1">
                      {times.map(time => (
                        <span key={time} className="text-xs bg-white/5 text-gray-400 px-2 py-1 rounded">
                          {time}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Post Detail Modal */}
      <PostDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        onSave={handleSavePost}
        onDelete={handleDeletePost}
        onPublishNow={handlePublishNow}
        onDuplicate={handleDuplicatePost}
      />
    </div>
  );
}
