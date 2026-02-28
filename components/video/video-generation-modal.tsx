'use client';

/**
 * Video Generation Modal
 *
 * Full-screen modal for the video generation workflow:
 * 1. User enters topic, selects style & duration
 * 2. Clicks "Generate Script" -> AI generates structured script
 * 3. Script preview shown with scenes, voiceover, visuals
 * 4. User can publish to platforms via scheduler
 *
 * @module components/video/video-generation-modal
 */

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Video,
  Sparkles,
  AlertTriangle,
  Send,
  Settings,
  Loader2,
} from '@/components/icons';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VideoProgress } from './video-progress';
import { VideoScriptPreview } from './video-script-preview';

// =============================================================================
// Types
// =============================================================================

interface ScriptScene {
  sceneNumber: number;
  duration: string;
  voiceover: string;
  visualDescription: string;
  textOverlay?: string;
}

interface ScriptContent {
  title: string;
  hook?: string;
  scenes: ScriptScene[];
  callToAction?: string;
  totalDuration: string;
  style: string;
  suggestedMusic?: string;
  hashtags?: string[];
}

interface GeneratedVideo {
  id: string;
  title: string;
  topic: string;
  style: string;
  duration: string;
  status: string;
  scriptContent: ScriptContent;
}

interface VideoGenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasApiKey?: boolean;
}

// =============================================================================
// Style options matching API schema
// =============================================================================

const STYLE_OPTIONS = [
  {
    value: 'social-reel',
    label: 'Social Reel',
    description: '15-60s short-form for Instagram, TikTok, LinkedIn',
  },
  {
    value: 'explainer',
    label: 'Explainer Video',
    description: '2-3 min deep-dive for YouTube',
  },
  {
    value: 'how-to',
    label: 'How-To Guide',
    description: '3-5 min tutorial for YouTube',
  },
] as const;

const DURATION_OPTIONS = {
  'social-reel': [{ value: '15-60s', label: '15-60 seconds' }],
  explainer: [{ value: '2-3m', label: '2-3 minutes' }],
  'how-to': [{ value: '3-5m', label: '3-5 minutes' }],
} as const;

const PUBLISH_PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
] as const;

// =============================================================================
// Component
// =============================================================================

export function VideoGenerationModal({
  open,
  onOpenChange,
  hasApiKey = true,
}: VideoGenerationModalProps) {
  // Form state
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState<string>('social-reel');
  const [duration, setDuration] = useState<string>('15-60s');

  // Generation state
  const [status, setStatus] = useState<'idle' | 'generating' | 'rendered' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideo | null>(null);

  // Publish state
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  // Reset state when modal closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setTopic('');
        setStyle('social-reel');
        setDuration('15-60s');
        setStatus('idle');
        setErrorMessage('');
        setGeneratedVideo(null);
        setSelectedPlatforms([]);
        setIsPublishing(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange]
  );

  // Update duration when style changes (each style has a fixed duration)
  const handleStyleChange = useCallback((newStyle: string) => {
    setStyle(newStyle);
    const durations = DURATION_OPTIONS[newStyle as keyof typeof DURATION_OPTIONS];
    if (durations?.length) {
      setDuration(durations[0].value);
    }
  }, []);

  // Generate script via API
  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) {
      toast.error('Please enter a topic for your video');
      return;
    }

    setStatus('generating');
    setErrorMessage('');
    setGeneratedVideo(null);

    try {
      const response = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ topic: topic.trim(), style, duration }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const msg = data.error || 'Failed to generate video script';
        setStatus('failed');
        setErrorMessage(msg);

        if (data.requiresApiKey) {
          toast.error('API key required. Add one in Settings.');
        } else {
          toast.error(msg);
        }
        return;
      }

      setGeneratedVideo(data.data);
      setStatus('rendered');
      toast.success('Script generated successfully');
    } catch (err) {
      setStatus('failed');
      const msg = err instanceof Error ? err.message : 'Network error';
      setErrorMessage(msg);
      toast.error('Failed to generate script. Please try again.');
    }
  }, [topic, style, duration]);

  // Toggle platform selection for publishing
  const togglePlatform = useCallback((platform: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform)
        ? prev.filter((p) => p !== platform)
        : [...prev, platform]
    );
  }, []);

  // Publish to selected platforms
  const handlePublish = useCallback(async () => {
    if (!generatedVideo || selectedPlatforms.length === 0) {
      toast.error('Select at least one platform to publish');
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch(`/api/video/${generatedVideo.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ platforms: selectedPlatforms }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        toast.error(data.error || 'Failed to schedule video posts');
        return;
      }

      const count = data.data?.scheduledPosts?.length || 0;
      toast.success(`Scheduled ${count} post${count !== 1 ? 's' : ''} successfully`);
      handleOpenChange(false);
    } catch {
      toast.error('Failed to publish. Please try again.');
    } finally {
      setIsPublishing(false);
    }
  }, [generatedVideo, selectedPlatforms, handleOpenChange]);

  // Determine available duration for selected style
  const availableDurations = DURATION_OPTIONS[style as keyof typeof DURATION_OPTIONS] || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        variant="glass-solid"
        overlayVariant="glass"
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-cyan-400" />
            Generate Video Script
          </DialogTitle>
          <DialogDescription>
            Create an AI-powered video script for marketing content.
          </DialogDescription>
        </DialogHeader>

        {/* API key gate */}
        {!hasApiKey ? (
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-amber-400 font-medium text-sm">
                API Key Required
              </span>
            </div>
            <p className="text-amber-400/80 text-xs mb-3">
              Video generation requires an AI API key. Add one in your account
              settings to get started.
            </p>
            <a
              href="/dashboard/settings"
              className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <Settings className="w-3 h-3" />
              Go to Settings
            </a>
          </div>
        ) : (
          <div className="space-y-5">
            {/* === Generation Form === */}
            {status === 'idle' || status === 'failed' ? (
              <div className="space-y-4">
                {/* Topic input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">
                    Topic
                  </label>
                  <textarea
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. 5 tips for small business Instagram marketing"
                    rows={2}
                    maxLength={500}
                    className="w-full rounded-lg bg-white/[0.03] border border-white/[0.08] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/20 resize-none transition-all"
                  />
                  <p className="text-xs text-gray-500">
                    {topic.length}/500 characters
                  </p>
                </div>

                {/* Style selector */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">
                    Video Style
                  </label>
                  <Select value={style} onValueChange={handleStyleChange}>
                    <SelectTrigger variant="glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent variant="glass-solid">
                      {STYLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex flex-col">
                            <span>{opt.label}</span>
                            <span className="text-xs text-gray-400">
                              {opt.description}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Duration selector */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-300">
                    Duration
                  </label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger variant="glass">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent variant="glass-solid">
                      {availableDurations.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Error from previous attempt */}
                {status === 'failed' && (
                  <VideoProgress
                    status="failed"
                    errorMessage={errorMessage}
                  />
                )}

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={!topic.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-medium text-sm hover:bg-cyan-500/30 hover:border-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Script
                </button>
              </div>
            ) : null}

            {/* === Generating State === */}
            {status === 'generating' && (
              <VideoProgress status="generating" />
            )}

            {/* === Rendered State — Script Preview + Publish === */}
            {status === 'rendered' && generatedVideo?.scriptContent && (
              <div className="space-y-5">
                <VideoProgress status="rendered" />

                {/* Script preview */}
                <VideoScriptPreview
                  script={generatedVideo.scriptContent}
                />

                {/* Publish section */}
                <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                  <h4 className="text-white font-medium text-sm flex items-center gap-2">
                    <Send className="w-3.5 h-3.5 text-cyan-400" />
                    Schedule to Platforms
                  </h4>
                  <p className="text-xs text-gray-500">
                    Select platforms to schedule posts with this video.
                  </p>

                  {/* Platform toggles */}
                  <div className="flex flex-wrap gap-2">
                    {PUBLISH_PLATFORMS.map((p) => {
                      const isSelected = selectedPlatforms.includes(p.value);
                      return (
                        <button
                          key={p.value}
                          onClick={() => togglePlatform(p.value)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
                              : 'bg-white/[0.03] border border-white/[0.08] text-gray-400 hover:border-white/[0.15] hover:text-gray-300'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handlePublish}
                      disabled={selectedPlatforms.length === 0 || isPublishing}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-medium text-sm hover:bg-emerald-500/30 hover:border-emerald-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPublishing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {isPublishing
                        ? 'Scheduling...'
                        : `Schedule${selectedPlatforms.length > 0 ? ` (${selectedPlatforms.length})` : ''}`}
                    </button>

                    <button
                      onClick={() => {
                        setStatus('idle');
                        setGeneratedVideo(null);
                      }}
                      className="px-4 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-gray-400 text-sm hover:bg-white/[0.06] hover:border-white/[0.15] transition-all"
                    >
                      New Script
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
