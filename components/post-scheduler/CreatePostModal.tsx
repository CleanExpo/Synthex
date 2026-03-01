'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Send } from '@/components/icons';
import { format } from 'date-fns';
import { platformIcons, platformColors, timeSlots } from './constants';
import type { ScheduledPost, NewPostData } from './types';

interface CreatePostModalProps {
  editingPost: ScheduledPost | null;
  newPost: NewPostData;
  onNewPostChange: (data: NewPostData) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function CreatePostModal({
  editingPost,
  newPost,
  onNewPostChange,
  onSubmit,
  onClose,
}: CreatePostModalProps) {
  return (
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
              onChange={(e) => onNewPostChange({ ...newPost, content: e.target.value })}
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
                        onNewPostChange({ ...newPost, platforms });
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
                onChange={(e) => onNewPostChange({ ...newPost, date: new Date(e.target.value) })}
                className="bg-white/5 border-white/10"
              />
            </div>
            <div className="space-y-2">
              <Label>Time</Label>
              <Select value={newPost.time} onValueChange={(v) => onNewPostChange({ ...newPost, time: v })}>
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
              onChange={(e) => onNewPostChange({ ...newPost, hashtags: e.target.value })}
              className="bg-white/5 border-white/10"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                checked={newPost.isRecurring}
                onCheckedChange={(checked) => onNewPostChange({ ...newPost, isRecurring: checked })}
              />
              <Label>Recurring Post</Label>
            </div>
            {newPost.isRecurring && (
              <Select
                value={newPost.recurringPattern}
                onValueChange={(v) => onNewPostChange({ ...newPost, recurringPattern: v })}
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
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button className="gradient-primary" onClick={onSubmit}>
              <Send className="w-4 h-4 mr-2" />
              {editingPost ? 'Update' : 'Schedule'} Post
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
