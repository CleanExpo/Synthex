'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar as CalendarIcon, Clock, Send, Edit3, Trash2, 
  Twitter, Instagram, Linkedin, Youtube, Facebook, Globe,
  Plus, ChevronLeft, ChevronRight, Filter, Download,
  Repeat, Bell, Eye, MoreVertical, Copy, CheckCircle,
  AlertCircle, XCircle, Loader2, Sparkles, TrendingUp
} from '@/components/icons';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, 
         isSameDay, isToday, isPast, isFuture, startOfMonth, endOfMonth } from 'date-fns';
import toast from 'react-hot-toast';

interface ScheduledPost {
  id: string;
  content: string;
  platforms: string[];
  scheduledTime: Date;
  status: 'scheduled' | 'published' | 'failed' | 'draft';
  media?: string[];
  hashtags?: string[];
  mentions?: string[];
  location?: string;
  isRecurring?: boolean;
  recurringPattern?: string;
  analytics?: {
    impressions?: number;
    engagement?: number;
    clicks?: number;
  };
}

const platformIcons = {
  twitter: Twitter,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
  all: Globe
};

const platformColors = {
  twitter: 'bg-blue-500',
  instagram: 'bg-gradient-to-br from-cyan-600 to-pink-500',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-600',
  facebook: 'bg-blue-600',
  all: 'bg-gray-600'
};

const timeSlots = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00'
];

export default function PostScheduler() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'timeline'>('calendar');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([
    {
      id: '1',
      content: 'Excited to share our latest AI-powered features! 🚀 Check out how SYNTHEX is revolutionizing social media management.',
      platforms: ['twitter', 'linkedin'],
      scheduledTime: addDays(new Date(), 1),
      status: 'scheduled',
      hashtags: ['#AI', '#SocialMedia', '#MarketingAutomation'],
      analytics: { impressions: 0, engagement: 0, clicks: 0 }
    },
    {
      id: '2',
      content: 'Behind the scenes of our product development process. Swipe to see how we build features that matter! 📸',
      platforms: ['instagram'],
      scheduledTime: addDays(new Date(), 2),
      status: 'scheduled',
      media: ['image1.jpg', 'image2.jpg'],
      hashtags: ['#BehindTheScenes', '#ProductDevelopment', '#StartupLife']
    },
    {
      id: '3',
      content: 'New video tutorial: "5 Ways to Boost Your Social Media Engagement" now live on our channel! 🎥',
      platforms: ['youtube', 'facebook'],
      scheduledTime: new Date(),
      status: 'published',
      analytics: { impressions: 12500, engagement: 890, clicks: 234 }
    }
  ]);

  const [newPost, setNewPost] = useState({
    content: '',
    platforms: [] as string[],
    date: new Date(),
    time: '12:00',
    hashtags: '',
    isRecurring: false,
    recurringPattern: 'daily'
  });

  const handleCreatePost = async () => {
    if (!newPost.content || newPost.platforms.length === 0) {
      toast.error('Please add content and select at least one platform');
      return;
    }

    const scheduledTime = new Date(newPost.date);
    const [hours, minutes] = newPost.time.split(':');
    scheduledTime.setHours(parseInt(hours), parseInt(minutes));

    const post: ScheduledPost = {
      id: Date.now().toString(),
      content: newPost.content,
      platforms: newPost.platforms,
      scheduledTime,
      status: 'scheduled',
      hashtags: newPost.hashtags ? newPost.hashtags.split(' ').filter(tag => tag.startsWith('#')) : [],
      isRecurring: newPost.isRecurring,
      recurringPattern: newPost.isRecurring ? newPost.recurringPattern : undefined
    };

    setScheduledPosts([...scheduledPosts, post]);
    setIsCreatingPost(false);
    setNewPost({
      content: '',
      platforms: [],
      date: new Date(),
      time: '12:00',
      hashtags: '',
      isRecurring: false,
      recurringPattern: 'daily'
    });
    toast.success('Post scheduled successfully!');
  };

  const handleDeletePost = (postId: string) => {
    setScheduledPosts(scheduledPosts.filter(post => post.id !== postId));
    toast.success('Post deleted');
  };

  const handleDuplicatePost = (post: ScheduledPost) => {
    const duplicatedPost: ScheduledPost = {
      ...post,
      id: Date.now().toString(),
      scheduledTime: addDays(post.scheduledTime, 1),
      status: 'scheduled'
    };
    setScheduledPosts([...scheduledPosts, duplicatedPost]);
    toast.success('Post duplicated');
  };

  const getPostsForDate = (date: Date) => {
    return scheduledPosts.filter(post => 
      isSameDay(post.scheduledTime, date) &&
      (selectedPlatform === 'all' || post.platforms.includes(selectedPlatform))
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'text-yellow-500';
      case 'published': return 'text-green-500';
      case 'failed': return 'text-red-500';
      case 'draft': return 'text-gray-500';
      default: return 'text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="w-4 h-4" />;
      case 'published': return <CheckCircle className="w-4 h-4" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'draft': return <Edit3 className="w-4 h-4" />;
      default: return null;
    }
  };

  // Calendar View
  const CalendarView = () => {
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
              onClick={() => setSelectedDate(day)}
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
  };

  // Timeline View
  const TimelineView = () => {
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
                          onClick={() => setEditingPost(post)}
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
  };

  // List View
  const ListView = () => {
    const filteredPosts = scheduledPosts
      .filter(post => selectedPlatform === 'all' || post.platforms.includes(selectedPlatform))
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());

    return (
      <div className="space-y-3">
        {filteredPosts.map(post => (
          <Card key={post.id} variant="glass">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {post.platforms.map(platform => {
                      const Icon = platformIcons[platform as keyof typeof platformIcons] || Globe;
                      return (
                        <div
                          key={platform}
                          className={`p-1 rounded ${platformColors[platform as keyof typeof platformColors]}`}
                        >
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                      );
                    })}
                    <span className={`flex items-center gap-1 text-sm ${getStatusColor(post.status)}`}>
                      {getStatusIcon(post.status)}
                      {post.status}
                    </span>
                    {post.isRecurring && (
                      <Badge variant="outline" className="text-xs">
                        <Repeat className="w-3 h-3 mr-1" />
                        {post.recurringPattern}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm mb-2 line-clamp-2">{post.content}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {format(post.scheduledTime, 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(post.scheduledTime, 'h:mm a')}
                    </span>
                    {post.hashtags && post.hashtags.length > 0 && (
                      <span>{post.hashtags.length} hashtags</span>
                    )}
                  </div>
                  {post.analytics && post.status === 'published' && (
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-green-400">
                        <Eye className="w-3 h-3 inline mr-1" />
                        {post.analytics.impressions?.toLocaleString()} views
                      </span>
                      <span className="text-blue-400">
                        <TrendingUp className="w-3 h-3 inline mr-1" />
                        {post.analytics.engagement} engagements
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDuplicatePost(post)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingPost(post)}
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold gradient-text">Content Calendar</h2>
          <p className="text-gray-400 mt-2">Schedule and manage your posts across all platforms</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              <SelectItem value="twitter">Twitter</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setIsCreatingPost(true)}
            className="bg-white/5 border-white/10"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Post
          </Button>
          <Button className="gradient-primary">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Suggest
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
        <TabsList>
          <TabsTrigger value="calendar">
            <CalendarIcon className="w-4 h-4 mr-2" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Clock className="w-4 h-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="list">
            <Filter className="w-4 h-4 mr-2" />
            List
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <Card variant="glass">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{format(selectedDate, 'MMMM yyyy')}</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedDate(addDays(selectedDate, -30))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedDate(addDays(selectedDate, 30))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CalendarView />
            </CardContent>
          </Card>

          {/* Selected Date Posts */}
          <Card variant="glass">
            <CardHeader>
              <CardTitle>Posts for {format(selectedDate, 'MMMM d, yyyy')}</CardTitle>
              <CardDescription>
                {getPostsForDate(selectedDate).length} scheduled posts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getPostsForDate(selectedDate).length > 0 ? (
                <div className="space-y-3">
                  {getPostsForDate(selectedDate).map(post => (
                    <div key={post.id} className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            {post.platforms.map(platform => {
                              const Icon = platformIcons[platform as keyof typeof platformIcons] || Globe;
                              return <Icon key={platform} className="w-4 h-4 text-gray-400" />;
                            })}
                            <span className="text-sm text-gray-400">
                              {format(post.scheduledTime, 'h:mm a')}
                            </span>
                          </div>
                          <p className="text-sm">{post.content}</p>
                        </div>
                        <Button size="icon" variant="ghost">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No posts scheduled for this date</p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => setIsCreatingPost(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule Post
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <Card variant="glass">
            <CardContent className="p-6">
              <TimelineView />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <ListView />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Post Modal */}
      {(isCreatingPost || editingPost) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card variant="glass" className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingPost ? 'Edit Post' : 'Schedule New Post'}
              </CardTitle>
              <CardDescription>
                Create and schedule content across multiple platforms
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  placeholder="What's on your mind?"
                  value={editingPost ? editingPost.content : newPost.content}
                  onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                  className="min-h-[150px] bg-white/5 border-white/10"
                />
                <p className="text-xs text-gray-400">
                  {(editingPost ? editingPost.content : newPost.content).length} characters
                </p>
              </div>

              <div className="space-y-2">
                <Label>Platforms</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(platformIcons).filter(([key]) => key !== 'all').map(([platform, Icon]) => {
                    const isSelected = editingPost 
                      ? editingPost.platforms.includes(platform)
                      : newPost.platforms.includes(platform);
                    
                    return (
                      <Button
                        key={platform}
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                          if (editingPost) {
                            // Handle edit mode
                          } else {
                            const platforms = isSelected
                              ? newPost.platforms.filter(p => p !== platform)
                              : [...newPost.platforms, platform];
                            setNewPost({ ...newPost, platforms });
                          }
                        }}
                        className={isSelected ? platformColors[platform as keyof typeof platformColors] : ''}
                      >
                        <Icon className="w-4 h-4 mr-2" />
                        {platform.charAt(0).toUpperCase() + platform.slice(1)}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={format(newPost.date, 'yyyy-MM-dd')}
                    onChange={(e) => setNewPost({ ...newPost, date: new Date(e.target.value) })}
                    className="bg-white/5 border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Select value={newPost.time} onValueChange={(v) => setNewPost({ ...newPost, time: v })}>
                    <SelectTrigger className="bg-white/5 border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Hashtags</Label>
                <Input
                  placeholder="#marketing #ai #socialmedia"
                  value={newPost.hashtags}
                  onChange={(e) => setNewPost({ ...newPost, hashtags: e.target.value })}
                  className="bg-white/5 border-white/10"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newPost.isRecurring}
                    onCheckedChange={(checked) => setNewPost({ ...newPost, isRecurring: checked })}
                  />
                  <Label>Recurring Post</Label>
                </div>
                {newPost.isRecurring && (
                  <Select 
                    value={newPost.recurringPattern} 
                    onValueChange={(v) => setNewPost({ ...newPost, recurringPattern: v })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreatingPost(false);
                    setEditingPost(null);
                  }}
                >
                  Cancel
                </Button>
                <Button className="gradient-primary" onClick={handleCreatePost}>
                  <Send className="w-4 h-4 mr-2" />
                  {editingPost ? 'Update' : 'Schedule'} Post
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}