'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
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
  Eye,
  Copy,
  MoreVertical,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Loader2,
} from '@/components/icons';
import toast from 'react-hot-toast';

// Platform icons
const platformIcons = {
  twitter: Twitter,
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Video,
};

// Mock scheduled posts
const mockScheduledPosts = [
  {
    id: 1,
    content: "🚀 Just shipped our biggest feature yet! AI-powered content generation is now live. Who's ready to 10x their social media game?",
    platform: 'twitter',
    scheduledFor: new Date('2024-01-20T14:00:00'),
    status: 'scheduled',
    engagement: { estimated: 8.5 },
    persona: 'Professional Voice',
  },
  {
    id: 2,
    content: "After 3 months of development, we're excited to announce that Synthex is transforming how businesses approach social media...",
    platform: 'linkedin',
    scheduledFor: new Date('2024-01-20T09:00:00'),
    status: 'scheduled',
    engagement: { estimated: 12.3 },
    persona: 'Thought Leader',
  },
  {
    id: 3,
    content: "POV: You just discovered the tool that writes viral content for you 🤯 #ContentCreation #AI #SocialMedia",
    platform: 'tiktok',
    scheduledFor: new Date('2024-01-21T19:00:00'),
    status: 'scheduled',
    engagement: { estimated: 25.7 },
    persona: 'Casual Creator',
  },
  {
    id: 4,
    content: "Behind the scenes of building an AI startup 📸 Swipe to see our journey from idea to launch →",
    platform: 'instagram',
    scheduledFor: new Date('2024-01-19T17:00:00'),
    status: 'published',
    engagement: { actual: 15.2, likes: 1250, comments: 89, shares: 45 },
    persona: 'Casual Creator',
  },
];

// Best times to post
const bestTimes = {
  twitter: ['9:00 AM', '12:00 PM', '3:00 PM', '7:00 PM'],
  linkedin: ['8:00 AM', '12:00 PM', '5:00 PM'],
  instagram: ['11:00 AM', '1:00 PM', '5:00 PM', '8:00 PM'],
  facebook: ['9:00 AM', '1:00 PM', '3:00 PM', '8:00 PM'],
  tiktok: ['6:00 AM', '10:00 AM', '7:00 PM', '10:00 PM'],
};

export default function SchedulePage() {
  const [posts, setPosts] = useState<typeof mockScheduledPosts>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load schedule data
  useEffect(() => {
    const loadSchedule = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Try to fetch from API
        const token = localStorage.getItem('token');
        if (token) {
          const response = await fetch('/api/scheduler/posts', {
            headers: { 'Authorization': `Bearer ${token}` },
          });

          if (response.ok) {
            const { data } = await response.json();
            // Map API data to frontend format
            const apiPosts = data.map((p: Record<string, unknown>) => ({
              id: typeof p.id === 'number' ? p.id : parseInt(p.id as string, 10) || Date.now(),
              content: (p.content as string) || '',
              platform: (p.platform as string) || 'twitter',
              scheduledFor: new Date(p.scheduledAt as string),
              status: (p.status as string) || 'scheduled',
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
      } catch (err) {
        // Fall back to mock data on error
        console.log('Using mock schedule data:', err);
        setPosts(mockScheduledPosts);
        setIsLoading(false);
      }
    };
    loadSchedule();
  }, []);

  const handleRetry = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const response = await fetch('/api/scheduler/posts', {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (response.ok) {
          const { data } = await response.json();
          if (data.length > 0) {
            setPosts(data);
            setIsLoading(false);
            return;
          }
        }
      }
      setPosts(mockScheduledPosts);
      setIsLoading(false);
    } catch {
      setPosts(mockScheduledPosts);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return <APIErrorCard title="Schedule Error" message={error} onRetry={handleRetry} />;
  }

  // Calculate stats
  const stats = {
    scheduled: posts.filter(p => p.status === 'scheduled').length,
    published: posts.filter(p => p.status === 'published').length,
    draft: posts.filter(p => p.status === 'draft').length,
    avgEngagement: posts.reduce((sum, p) => sum + (p.engagement.actual || p.engagement.estimated || 0), 0) / posts.length,
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days: (Date | null)[] = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of month
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

  const handleCreatePost = () => {
    setIsCreating(true);
    // In production, this would open a modal or navigate to content creation
    toast.success('Opening content creator...');
    setTimeout(() => setIsCreating(false), 1000);
  };

  const handleDeletePost = (id: number) => {
    setPosts(prev => prev.filter(p => p.id !== id));
    toast.success('Post deleted');
  };

  const handleReschedule = (post: any) => {
    setSelectedPost(post);
    toast.success('Reschedule modal would open here');
  };

  const handlePublishNow = (post: any) => {
    setPosts(prev => prev.map(p => 
      p.id === post.id ? { ...p, status: 'published' } : p
    ));
    toast.success('Post published successfully!');
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const filteredPosts = posts.filter(post => {
    if (filterPlatform !== 'all' && post.platform !== filterPlatform) return false;
    if (filterStatus !== 'all' && post.status !== filterStatus) return false;
    return true;
  });

  const handleExportSchedule = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      filters: {
        platform: filterPlatform,
        status: filterStatus,
      },
      stats,
      posts: filteredPosts.map(post => ({
        ...post,
        scheduledFor: post.scheduledFor.toISOString(),
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
            const importedPosts = data.posts.map((post: any, index: number) => ({
              ...post,
              id: Date.now() + index,
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

  const PlatformIcon = (platform: string) => {
    const Icon = platformIcons[platform as keyof typeof platformIcons];
    return Icon ? <Icon className="h-4 w-4" /> : null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Content Schedule</h1>
          <p className="text-gray-400 mt-1">
            Plan and schedule your content across all platforms
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
            onClick={handleCreatePost}
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
            <Clock className="h-4 w-4 text-purple-500" />
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
            <TrendingUp className="h-4 w-4 text-purple-500" />
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
        <div className="flex space-x-2 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              viewMode === 'calendar'
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-2" />
            Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              viewMode === 'list'
                ? 'bg-purple-500/20 text-purple-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <BarChart3 className="h-4 w-4 inline mr-2" />
            List
          </button>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'calendar' ? (
        <Card variant="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
                  onClick={() => setCurrentMonth(new Date())}
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
              {/* Weekday headers */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="bg-gray-900 p-2 text-center text-xs font-medium text-gray-400">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {getDaysInMonth(currentMonth).map((date, index) => {
                const postsForDay = date ? getPostsForDate(date) : [];
                const isToday = date && date.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={index}
                    className={`bg-gray-900 min-h-[100px] p-2 ${
                      date ? 'hover:bg-white/5 cursor-pointer' : ''
                    } ${isToday ? 'ring-1 ring-purple-500' : ''}`}
                  >
                    {date && (
                      <>
                        <div className={`text-sm mb-1 ${isToday ? 'text-purple-400 font-bold' : 'text-gray-400'}`}>
                          {date.getDate()}
                        </div>
                        <div className="space-y-1">
                          {postsForDay.slice(0, 3).map(post => (
                            <div
                              key={post.id}
                              className={`text-xs p-1 rounded flex items-center space-x-1 ${
                                post.status === 'published'
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-purple-500/20 text-purple-300'
                              }`}
                            >
                              {PlatformIcon(post.platform)}
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
          {filteredPosts.map(post => (
            <Card key={post.id} variant="glass">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        post.status === 'published'
                          ? 'bg-green-500/20'
                          : post.status === 'scheduled'
                          ? 'bg-purple-500/20'
                          : 'bg-gray-500/20'
                      }`}>
                        {PlatformIcon(post.platform)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white capitalize">{post.platform}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(post.scheduledFor).toLocaleString()}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        post.status === 'published'
                          ? 'bg-green-500/20 text-green-300'
                          : post.status === 'scheduled'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-gray-500/20 text-gray-300'
                      }`}>
                        {post.status}
                      </span>
                    </div>
                    <p className="text-white mb-3">{post.content}</p>
                    <div className="flex items-center space-x-4 text-xs text-gray-400">
                      <span>Persona: {post.persona}</span>
                      {post.status === 'published' ? (
                        <>
                          <span>❤️ {post.engagement.likes}</span>
                          <span>💬 {post.engagement.comments}</span>
                          <span>🔄 {post.engagement.shares}</span>
                          <span className="text-green-400">
                            {post.engagement.actual}% engagement
                          </span>
                        </>
                      ) : (
                        <span className="text-purple-400">
                          Est. {post.engagement.estimated}% engagement
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {post.status === 'scheduled' && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReschedule(post)}
                          className="text-gray-400"
                        >
                          <Clock className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePublishNow(post)}
                          className="text-gray-400"
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
          ))}
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
          <div className="space-y-3">
            {Object.entries(bestTimes).map(([platform, times]) => {
              const Icon = platformIcons[platform as keyof typeof platformIcons];
              return (
                <div key={platform} className="flex items-start space-x-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Icon className="h-4 w-4 text-purple-400" />
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
    </div>
  );
}