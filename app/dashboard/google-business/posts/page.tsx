'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useGBPLocations } from '@/hooks/useGBPLocations';
import { GBPConnectionBanner } from '@/components/google/GBPConnectionBanner';
import { ArrowLeft, Globe, Plus, Send, Loader2 } from '@/components/icons';

export default function GBPPostsPage() {
  const { locations, primaryLocation } = useGBPLocations();
  const [summary, setSummary] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const hasLocations = locations.length > 0;

  const handleCreatePost = async () => {
    if (!summary.trim() || !primaryLocation) return;
    setCreating(true);
    setSuccessMessage('');

    try {
      const response = await fetch('/api/google-business/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          locationId: primaryLocation.id,
          summary: summary.trim(),
        }),
      });

      if (response.ok) {
        setSummary('');
        setShowForm(false);
        setSuccessMessage('Post published successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/google-business"
          className="text-sm text-gray-400 hover:text-amber-400 flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Google Business
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Globe className="w-7 h-7 text-amber-400" />
              Google Posts
            </h1>
            <p className="text-gray-400 mt-1">
              Create and manage posts on your Google Business Profile
            </p>
          </div>
          {hasLocations && (
            <Button
              onClick={() => setShowForm(!showForm)}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Post
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

      {showForm && primaryLocation && (
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-amber-500/10">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Create New Post
            </h2>
            <p className="text-sm text-gray-400 mb-3">
              Posting to: {primaryLocation.locationName}
            </p>
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Write your Google Post content... (max 1,500 characters)"
              maxLength={1500}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[120px] mb-3"
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
                  }}
                  className="text-gray-400"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCreatePost}
                  disabled={creating || !summary.trim()}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 text-white"
                >
                  {creating ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Send className="w-3 h-3 mr-1" />
                  )}
                  Publish Post
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasLocations && !showForm && (
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">Google Posts</h3>
          <p className="text-gray-400 mb-4">
            Create posts to share updates, offers, and events on your Google
            Business Profile.
          </p>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-gradient-to-r from-amber-500 to-amber-600 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Your First Post
          </Button>
        </div>
      )}
    </div>
  );
}
