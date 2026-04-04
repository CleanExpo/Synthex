'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useGBPLocations } from '@/hooks/useGBPLocations';
import { GBPConnectionBanner } from '@/components/google/GBPConnectionBanner';
import {
  ArrowLeft,
  Globe,
  Plus,
  Send,
  Loader2,
  ImageIcon,
  Upload,
  X,
} from '@/components/icons';
import { toast } from 'sonner';

type PostType = 'STANDARD' | 'EVENT' | 'OFFER';

export default function GBPPostsPage() {
  const { locations, primaryLocation } = useGBPLocations();
  const [summary, setSummary] = useState('');
  const [postType, setPostType] = useState<PostType>('STANDARD');
  const [eventTitle, setEventTitle] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Photo upload state
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasLocations = locations.length > 0;

  const handleCreatePost = async () => {
    if (!summary.trim() || !primaryLocation) return;
    setCreating(true);
    setSuccessMessage('');

    try {
      const body: Record<string, unknown> = {
        locationId: primaryLocation.id,
        summary: summary.trim(),
        topicType: postType,
      };
      if (postType === 'EVENT') {
        if (!eventTitle.trim() || !eventStart || !eventEnd) {
          toast.error('Event title and dates are required for event posts');
          return;
        }
        body.eventTitle = eventTitle.trim();
        body.eventStartDate = eventStart;
        body.eventEndDate = eventEnd;
      }

      const response = await fetch('/api/google-business/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (response.ok) {
        setSummary('');
        setEventTitle('');
        setEventStart('');
        setEventEnd('');
        setShowForm(false);
        setSuccessMessage(
          postType === 'EVENT'
            ? 'Event published to Google Business Profile!'
            : 'Post published successfully!'
        );
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        const err = await response.json().catch(() => ({}));
        toast.error(
          (err as { error?: string }).error ?? 'Failed to publish post'
        );
      }
    } finally {
      setCreating(false);
    }
  };

  const handlePhotoUpload = useCallback(
    async (file: File) => {
      if (!primaryLocation) {
        toast.error('No location selected');
        return;
      }
      setUploadingPhoto(true);
      setPhotoPreview(URL.createObjectURL(file));
      try {
        const fd = new FormData();
        fd.append('photo', file);
        fd.append('locationId', primaryLocation.id);
        const res = await fetch('/api/google-business/photos', {
          method: 'POST',
          credentials: 'include',
          body: fd,
        });
        if (res.ok) {
          toast.success('Photo uploaded to Google Business Profile!');
        } else {
          const err = await res.json().catch(() => ({}));
          toast.error((err as { error?: string }).error ?? 'Upload failed');
          setPhotoPreview(null);
        }
      } finally {
        setUploadingPhoto(false);
      }
    },
    [primaryLocation]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handlePhotoUpload(file);
    },
    [handlePhotoUpload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handlePhotoUpload(file);
    },
    [handlePhotoUpload]
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/google-business"
          className="text-sm text-gray-300 hover:text-orange-400 flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Google Business
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Globe className="w-7 h-7 text-orange-400" />
              Google Posts &amp; Photos
            </h1>
            <p className="text-gray-300 mt-1">
              Publish posts and upload photos to your Google Business Profile
            </p>
          </div>
          {hasLocations && (
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Post
            </Button>
          )}
        </div>
      </div>

      {!hasLocations && <GBPConnectionBanner />}

      {successMessage && (
        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-sm">
          {successMessage}
        </div>
      )}

      {/* Photo Upload Section */}
      {hasLocations && (
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-orange-400" />
              Upload Photo
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              Photos appear on your GBP listing within 60 seconds.
            </p>

            {/* Drag-and-drop zone */}
            <div
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleFileDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-orange-400 bg-orange-500/10'
                  : 'border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileInput}
              />

              {uploadingPhoto ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
                  <p className="text-sm text-gray-300">Uploading to Google…</p>
                </div>
              ) : photoPreview ? (
                <div className="relative inline-block">
                  <img
                    src={photoPreview}
                    alt="Preview"
                    className="max-h-40 rounded-lg mx-auto"
                  />
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setPhotoPreview(null);
                    }}
                    className="absolute -top-2 -right-2 bg-zinc-800 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3 text-gray-300" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-zinc-500" />
                  <p className="text-sm text-gray-300">
                    Drag &amp; drop or click to select a photo
                  </p>
                  <p className="text-xs text-gray-500">
                    JPG, PNG, WebP up to 10 MB
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Post Form */}
      {showForm && primaryLocation && (
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">
              Schedule a Post
            </h2>
            <p className="text-sm text-gray-300">
              Posting to: {primaryLocation.locationName}
            </p>

            {/* Post type selector */}
            <div className="flex gap-2">
              {(['STANDARD', 'EVENT', 'OFFER'] as PostType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setPostType(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    postType === t
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-zinc-700 text-gray-300 hover:border-zinc-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* EVENT fields */}
            {postType === 'EVENT' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder="Event title (max 58 chars)"
                  value={eventTitle}
                  onChange={e => setEventTitle(e.target.value.slice(0, 58))}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
                <Input
                  type="date"
                  value={eventStart}
                  onChange={e => setEventStart(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
                <Input
                  type="date"
                  value={eventEnd}
                  onChange={e => setEventEnd(e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
            )}

            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Write your Google Post content… (max 1,500 characters)"
              maxLength={1500}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[120px]"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {summary.length}/1,500
              </span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setSummary('');
                    setEventTitle('');
                    setEventStart('');
                    setEventEnd('');
                  }}
                  className="text-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreatePost}
                  disabled={creating || !summary.trim()}
                  className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
                >
                  {creating ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Send className="w-3 h-3 mr-1" />
                  )}
                  Publish
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasLocations && !showForm && (
        <div className="text-center py-8">
          <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Google Posts</h3>
          <p className="text-gray-300 mb-4">
            Share updates, events, and offers directly on your Google Business
            Profile.
          </p>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-orange-500 to-orange-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Post
          </Button>
        </div>
      )}
    </div>
  );
}
