'use client';

import { useState, useCallback, useMemo } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { toast } from 'sonner';
import Link from 'next/link';
import { Brain, Building, ChevronDown, Layers } from '@/components/icons';
import { fetchWithCSRF } from '@/lib/csrf';

import {
  type GeneratedContentData,
  ContentHeader,
  ContentStats,
  GenerationSettings,
  GeneratedContent,
  MediaAttacher,
  PlatformPreview,
  PublishConfirmModal,
  PostStatusTracker,
  type PublishOptions,
  type PlatformScheduleResult,
} from '@/components/content';
import { GenerateVideoCard, VideoGenerationModal } from '@/components/video';
import { BulkScheduleWizard } from '@/components/scheduling';
import { usePersonas } from '@/hooks/use-personas';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

export default function ContentPage() {
  // Multi-business context
  const { businesses, activeBusiness, isOwner, switchBusiness } = useActiveBusiness();

  // Fetch personas from API
  const { personas: apiPersonas, loading: personasLoading } = usePersonas();

  // Transform personas for GenerationSettings (only active ones)
  const personas = useMemo(() => {
    return apiPersonas
      .filter((p) => p.status === 'active')
      .map((p) => ({ id: p.id, name: p.name }));
  }, [apiPersonas]);

  const [platform, setPlatform] = useState('twitter');
  const [topic, setTopic] = useState('');
  const [hookType, setHookType] = useState('question');
  const [tone, setTone] = useState('casual');
  const [personaId, setPersonaId] = useState('none');
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [includeEmojis, setIncludeEmojis] = useState(true);
  const [targetLength, setTargetLength] = useState('medium');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentData | null>(null);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const [psychologyScore, setPsychologyScore] = useState<{overallScore: number, topPrinciples: {name: string, strength: number}[], predictedEngagement: {level: string}} | null>(null);

  // Media attachments
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  // Video generation modal
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // Publish confirmation modal
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // Multi-platform state
  const [multiPlatformEnabled, setMultiPlatformEnabled] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['twitter']);
  const [platformAdaptations, setPlatformAdaptations] = useState<Record<string, string>>({});
  const [isAdapting, setIsAdapting] = useState(false);

  // Post status tracking (populated after multi-platform schedule)
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  // Bulk schedule wizard
  const [bulkWizardOpen, setBulkWizardOpen] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!topic) {
      toast.error('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setPsychologyScore(null);
    setPlatformAdaptations({});
    try {
      const response = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'post',
          platform,
          topic,
          tone,
          includeHashtags,
          includeEmojis,
          includeCTA: hookType === 'achievement',
          length: targetLength,
          personaId: personaId !== 'none' ? personaId : undefined,
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        const aiData = data.data;
        const transformedContent: GeneratedContentData = {
          primary: aiData.content,
          variations: aiData.variations?.map((v: { content: string }) => v.content) || [],
          metadata: {
            platform: aiData.platform,
            hookType: hookType,
            length: aiData.content?.length || 0,
            estimatedEngagement: aiData.estimatedEngagement || aiData.viralScore || 75,
            hashtags: aiData.hashtags || [],
          }
        };
        setGeneratedContent(transformedContent);
        setEditedContent(transformedContent.primary);
        toast.success('Content generated successfully!');

        // Multi-platform: adapt content for secondary platforms
        const secondaryPlatforms = multiPlatformEnabled
          ? selectedPlatforms.filter((p) => p !== platform)
          : [];

        if (secondaryPlatforms.length > 0) {
          setIsAdapting(true);
          try {
            const crossPostRes = await fetch('/api/content/cross-post', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                content: transformedContent.primary,
                platforms: secondaryPlatforms,
                tone,
                mode: 'preview',
                personaId: personaId !== 'none' ? personaId : undefined,
              }),
            });
            const crossPostData = await crossPostRes.json();
            if (crossPostData.success && crossPostData.variants) {
              const adaptations: Record<string, string> = {
                [platform]: transformedContent.primary,
              };
              for (const variant of crossPostData.variants) {
                adaptations[variant.platform] = variant.content;
              }
              setPlatformAdaptations(adaptations);
              toast.success(`Content adapted for ${secondaryPlatforms.length} additional platform${secondaryPlatforms.length > 1 ? 's' : ''}`);
            }
          } catch {
            toast.error('Failed to adapt content for other platforms');
          } finally {
            setIsAdapting(false);
          }
        }

        // Auto-analyze with psychology analyzer
        try {
          const psychRes = await fetch('/api/psychology/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              content: transformedContent.primary,
              platform,
              contentType: 'post',
            }),
          });
          const psychData = await psychRes.json();
          if (psychData.success && psychData.data?.analysis) {
            setPsychologyScore({
              overallScore: psychData.data.analysis.overallScore,
              topPrinciples: psychData.data.analysis.principlesDetected
                ?.slice(0, 3)
                .map((p: any) => ({ name: p.name, strength: p.strength })) || [],
              predictedEngagement: psychData.data.analysis.predictedEngagement,
            });
          }
        } catch {
          // Psychology analysis is optional, don't block
        }
      } else {
        toast.error(data.error || data.message || 'Failed to generate content');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  }, [topic, platform, tone, includeHashtags, includeEmojis, hookType, targetLength, personaId, multiPlatformEnabled, selectedPlatforms]);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  }, []);

  const handleSave = useCallback(async () => {
    const contentToSave = editMode && editedContent
      ? editedContent
      : generatedContent?.variations?.[selectedVariation]
        ? generatedContent.variations[selectedVariation]
        : generatedContent?.primary;

    if (!contentToSave) {
      toast.error('Generate content first before saving');
      return;
    }

    try {
      const response = await fetchWithCSRF('/api/content-drafts', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          content: contentToSave,
          title: topic || `${platform} post`,
          hashtags: generatedContent?.metadata?.hashtags || [],
          hookType,
          tone,
          topic,
          targetLength,
          ...(mediaUrls.length > 0 ? { images: mediaUrls } : {}),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to save');
      }

      toast.success('Draft saved!', {
        action: {
          label: 'View Drafts',
          onClick: () => { window.location.href = '/dashboard/content/drafts'; },
        },
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save content');
    }
  }, [generatedContent, editMode, editedContent, selectedVariation, topic, platform, tone, hookType, targetLength, mediaUrls]);

  const handleScheduleClick = useCallback(() => {
    if (!generatedContent) {
      toast.error('Generate content first before scheduling');
      return;
    }
    setPublishModalOpen(true);
  }, [generatedContent]);

  const handlePublishConfirm = useCallback(async (options: PublishOptions) => {
    const contentText = editMode && editedContent
      ? editedContent
      : generatedContent?.variations?.[selectedVariation] || generatedContent?.primary;

    if (!contentText) {
      toast.error('No content to schedule');
      return;
    }

    const response = await fetchWithCSRF('/api/scheduler/posts', {
      method: 'POST',
      body: JSON.stringify({
        content: contentText,
        platform: options.platform,
        scheduledAt: options.scheduledAt,
        metadata: {
          hashtags: generatedContent?.metadata?.hashtags || [],
          persona: personaId !== 'none' ? personaId : undefined,
          estimatedEngagement: psychologyScore?.predictedEngagement ? 8 : 5,
          ...(mediaUrls.length > 0 ? { images: mediaUrls } : {}),
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as { message?: string }).message || `Failed to schedule (${response.status})`);
    }

    toast.success('Post scheduled! View it in your Schedule page.', {
      action: {
        label: 'View Schedule',
        onClick: () => { window.location.href = '/dashboard/schedule'; },
      },
    });
  }, [generatedContent, editMode, editedContent, selectedVariation, personaId, psychologyScore, mediaUrls]);

  const handleMultiPublishConfirm = useCallback(async (options: {
    scheduledAt: string;
    platforms: string[];
    batchId: string;
  }): Promise<PlatformScheduleResult[]> => {
    const results: PlatformScheduleResult[] = [];

    for (const targetPlatform of options.platforms) {
      try {
        const contentText = platformAdaptations[targetPlatform]
          || (editMode && editedContent ? editedContent : null)
          || generatedContent?.primary
          || '';

        const response = await fetchWithCSRF('/api/scheduler/posts', {
          method: 'POST',
          body: JSON.stringify({
            content: contentText,
            platform: targetPlatform,
            scheduledAt: options.scheduledAt,
            metadata: {
              hashtags: generatedContent?.metadata?.hashtags || [],
              persona: personaId !== 'none' ? personaId : undefined,
              estimatedEngagement: psychologyScore?.predictedEngagement ? 8 : 5,
              batchId: options.batchId,
              ...(mediaUrls.length > 0 ? { images: mediaUrls } : {}),
            },
          }),
        });

        if (response.ok) {
          results.push({ platform: targetPlatform, success: true });
        } else {
          const errData = await response.json().catch(() => ({}));
          results.push({
            platform: targetPlatform,
            success: false,
            error: (errData as { message?: string }).message || `HTTP ${response.status}`,
          });
        }
      } catch (err) {
        results.push({
          platform: targetPlatform,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    if (successCount === results.length) {
      setLastBatchId(options.batchId);
      toast.success(`Scheduled to ${successCount} platforms!`, {
        action: {
          label: 'View Schedule',
          onClick: () => { window.location.href = '/dashboard/schedule'; },
        },
      });
    } else if (successCount > 0) {
      setLastBatchId(options.batchId);
      toast.warning(`Scheduled ${successCount}/${results.length} platforms. Some failed.`);
    } else {
      toast.error('All platform schedules failed.');
    }

    return results;
  }, [platformAdaptations, editMode, editedContent, generatedContent, personaId, psychologyScore, mediaUrls]);

  const handleViewAnalytics = useCallback(() => {
    window.location.href = '/dashboard/analytics';
  }, []);

  if (isLoading || personasLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Content Generator Error"
          message={error}
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContentHeader onViewAnalytics={handleViewAnalytics} />

      {/* Business context selector for multi-business owners */}
      {isOwner && businesses.length > 0 && (
        <div className="glass-card p-3 rounded-xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-cyan-400" />
            <span className="text-sm text-slate-400">Creating for:</span>
            <select
              value={activeBusiness?.organizationId ?? ''}
              onChange={async (e) => {
                try {
                  await switchBusiness(e.target.value || null);
                  toast.success(`Switched to ${businesses.find(b => b.organizationId === e.target.value)?.displayName || businesses.find(b => b.organizationId === e.target.value)?.organizationName}`);
                } catch {
                  toast.error('Failed to switch business');
                }
              }}
              className="bg-[#0f172a] border border-cyan-500/20 rounded-lg px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-cyan-500/30 focus:outline-none appearance-none cursor-pointer"
            >
              {businesses.map((b) => (
                <option key={b.organizationId} value={b.organizationId}>
                  {b.displayName || b.organizationName}
                </option>
              ))}
            </select>
          </div>
          {activeBusiness && (
            <span className="text-xs text-slate-500">
              {activeBusiness.stats?.activePlatforms ?? 0} platforms connected
            </span>
          )}
        </div>
      )}

      <ContentStats />

      {/* Video generation entry point */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GenerateVideoCard onClick={() => setVideoModalOpen(true)} />
      </div>

      <VideoGenerationModal
        open={videoModalOpen}
        onOpenChange={setVideoModalOpen}
      />

      {/* Media attachments */}
      <div className="glass-card p-4 rounded-xl border border-white/10">
        <MediaAttacher
          mediaUrls={mediaUrls}
          onMediaChange={setMediaUrls}
          maxFiles={4}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GenerationSettings
          platform={platform}
          onPlatformChange={setPlatform}
          topic={topic}
          onTopicChange={setTopic}
          hookType={hookType}
          onHookTypeChange={setHookType}
          tone={tone}
          onToneChange={setTone}
          personaId={personaId}
          onPersonaChange={setPersonaId}
          personas={personas}
          targetLength={targetLength}
          onTargetLengthChange={setTargetLength}
          includeHashtags={includeHashtags}
          onIncludeHashtagsChange={setIncludeHashtags}
          includeEmojis={includeEmojis}
          onIncludeEmojisChange={setIncludeEmojis}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
          multiPlatformEnabled={multiPlatformEnabled}
          onMultiPlatformToggle={setMultiPlatformEnabled}
          selectedPlatforms={selectedPlatforms}
          onSelectedPlatformsChange={setSelectedPlatforms}
        />

        <GeneratedContent
          content={generatedContent}
          selectedVariation={selectedVariation}
          onVariationChange={setSelectedVariation}
          editMode={editMode}
          onEditModeToggle={() => setEditMode(!editMode)}
          editedContent={editedContent}
          onEditedContentChange={setEditedContent}
          onRefresh={handleGenerate}
          onCopy={handleCopy}
          onSave={handleSave}
          onSchedule={handleScheduleClick}
        />
      </div>

      {/* Schedule More -- opens BulkScheduleWizard pre-filled with current content */}
      {generatedContent && (
        <div className="flex justify-end">
          <button
            onClick={() => setBulkWizardOpen(true)}
            className="flex items-center gap-1.5 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <Layers className="h-4 w-4" />
            Schedule More Posts
          </button>
        </div>
      )}

      <BulkScheduleWizard
        open={bulkWizardOpen}
        onOpenChange={setBulkWizardOpen}
        initialContent={
          generatedContent
            ? (editMode && editedContent ? editedContent : generatedContent.primary)
            : undefined
        }
        initialPlatform={platform}
      />

      {/* Platform preview(s) */}
      {generatedContent && (
        <>
          {multiPlatformEnabled && Object.keys(platformAdaptations).length > 1 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-slate-400">
                Platform Previews ({Object.keys(platformAdaptations).length} platforms)
                {isAdapting && <span className="ml-2 text-cyan-400 animate-pulse">Adapting...</span>}
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {selectedPlatforms.map((p) => (
                  <div key={p} className="glass-card p-4 rounded-xl border border-white/10">
                    <PlatformPreview
                      platform={p}
                      content={
                        p === platform
                          ? (editMode ? editedContent : generatedContent.primary)
                          : (platformAdaptations[p] || generatedContent.primary)
                      }
                      mediaUrls={mediaUrls}
                      hashtags={generatedContent.metadata?.hashtags}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-card p-4 rounded-xl border border-white/10">
              <PlatformPreview
                platform={platform}
                content={editMode ? editedContent : generatedContent.primary}
                mediaUrls={mediaUrls}
                hashtags={generatedContent.metadata?.hashtags}
              />
            </div>
          )}
        </>
      )}

      {psychologyScore && generatedContent && (
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-400" />
              Psychology Analysis
            </h3>
            <Link href="/dashboard/psychology" className="text-xs text-cyan-400 hover:text-cyan-300">
              Full Analysis →
            </Link>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                psychologyScore.overallScore >= 70 ? 'text-green-400' :
                psychologyScore.overallScore >= 40 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {psychologyScore.overallScore}
              </div>
              <div className="text-xs text-slate-400">Score</div>
            </div>
            <div className="flex-1 flex flex-wrap gap-2">
              {psychologyScore.topPrinciples.map((p) => (
                <span key={p.name} className="text-xs bg-purple-500/10 text-purple-300 px-2 py-1 rounded-full border border-purple-500/20">
                  {p.name} ({p.strength}%)
                </span>
              ))}
            </div>
            <div className={`text-xs px-2 py-1 rounded-full ${
              psychologyScore.predictedEngagement.level === 'viral' ? 'bg-green-500/20 text-green-400' :
              psychologyScore.predictedEngagement.level === 'high' ? 'bg-cyan-500/20 text-cyan-400' :
              psychologyScore.predictedEngagement.level === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {psychologyScore.predictedEngagement.level} engagement
            </div>
          </div>
        </div>
      )}

      {/* Post status tracker (shown after multi-platform schedule) */}
      {lastBatchId && (
        <PostStatusTracker
          batchId={lastBatchId}
          onRefresh={() => setLastBatchId(lastBatchId)}
          onDismiss={() => setLastBatchId(null)}
        />
      )}

      {/* Publish confirmation modal */}
      <PublishConfirmModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        content={
          editMode && editedContent
            ? editedContent
            : generatedContent?.variations?.[selectedVariation] || generatedContent?.primary || ''
        }
        platform={platform}
        mediaUrls={mediaUrls}
        hashtags={generatedContent?.metadata?.hashtags}
        onConfirm={handlePublishConfirm}
        selectedPlatforms={multiPlatformEnabled ? selectedPlatforms : undefined}
        platformAdaptations={multiPlatformEnabled ? platformAdaptations : undefined}
        onMultiConfirm={multiPlatformEnabled && selectedPlatforms.length > 1 ? handleMultiPublishConfirm : undefined}
      />
    </div>
  );
}
