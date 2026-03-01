'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar as CalendarIcon, Clock, Plus, ChevronLeft, ChevronRight,
  Filter, Sparkles
} from '@/components/icons';
import { format, addDays, isSameDay } from 'date-fns';
import { toast } from 'sonner';

import { CalendarView } from './CalendarView';
import { TimelineView } from './TimelineView';
import { ListView } from './ListView';
import { CreatePostModal } from './CreatePostModal';
import { SelectedDatePosts } from './SelectedDatePosts';
import type { ScheduledPost, NewPostData } from './types';

const defaultNewPost: NewPostData = {
  content: '',
  platforms: [],
  date: new Date(),
  time: '12:00',
  hashtags: '',
  isRecurring: false,
  recurringPattern: 'daily'
};

export function PostScheduler() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list' | 'timeline'>('calendar');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);

  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([
    {
      id: '1',
      content: 'Excited to share our latest AI-powered features! \u{1F680} Check out how SYNTHEX is revolutionizing social media management.',
      platforms: ['twitter', 'linkedin'],
      scheduledTime: addDays(new Date(), 1),
      status: 'scheduled',
      hashtags: ['#AI', '#SocialMedia', '#MarketingAutomation'],
      analytics: { impressions: 0, engagement: 0, clicks: 0 }
    },
    {
      id: '2',
      content: 'Behind the scenes of our product development process. Swipe to see how we build features that matter! \u{1F4F8}',
      platforms: ['instagram'],
      scheduledTime: addDays(new Date(), 2),
      status: 'scheduled',
      media: ['image1.jpg', 'image2.jpg'],
      hashtags: ['#BehindTheScenes', '#ProductDevelopment', '#StartupLife']
    },
    {
      id: '3',
      content: 'New video tutorial: "5 Ways to Boost Your Social Media Engagement" now live on our channel! \u{1F3A5}',
      platforms: ['youtube', 'facebook'],
      scheduledTime: new Date(),
      status: 'published',
      analytics: { impressions: 12500, engagement: 890, clicks: 234 }
    }
  ]);

  const [newPost, setNewPost] = useState<NewPostData>(defaultNewPost);

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
    setNewPost(defaultNewPost);
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
                    aria-label="Previous month"
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
                    aria-label="Next month"
                    onClick={() => setSelectedDate(addDays(selectedDate, 30))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CalendarView
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                getPostsForDate={getPostsForDate}
              />
            </CardContent>
          </Card>

          <SelectedDatePosts
            selectedDate={selectedDate}
            posts={getPostsForDate(selectedDate)}
            onCreatePost={() => setIsCreatingPost(true)}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <Card variant="glass">
            <CardContent className="p-6">
              <TimelineView
                selectedDate={selectedDate}
                getPostsForDate={getPostsForDate}
                onEditPost={setEditingPost}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <ListView
            scheduledPosts={scheduledPosts}
            selectedPlatform={selectedPlatform}
            onDuplicate={handleDuplicatePost}
            onEdit={setEditingPost}
            onDelete={handleDeletePost}
          />
        </TabsContent>
      </Tabs>

      {/* Create/Edit Post Modal */}
      {(isCreatingPost || editingPost) && (
        <CreatePostModal
          editingPost={editingPost}
          newPost={newPost}
          onNewPostChange={setNewPost}
          onSubmit={handleCreatePost}
          onClose={() => {
            setIsCreatingPost(false);
            setEditingPost(null);
          }}
        />
      )}
    </div>
  );
}

export default PostScheduler;
