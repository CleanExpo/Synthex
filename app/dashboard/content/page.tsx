'use client';

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import { toast } from 'sonner';
import Link from 'next/link';
import { Brain, Building, ChevronDown, Layers } from '@/components/icons';
import { fetchWithCSRF } from '@/lib/csrf';
import { useAutoSave } from '@/hooks/useAutoSave';
import { EngagementBadge } from '@/components/content/EngagementBadge';

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
import { EngagementPrediction } from '@/components/content/EngagementPrediction';
import { GenerateVideoCard, VideoGenerationModal } from '@/components/video';
import { BulkScheduleWizard } from '@/components/scheduling';
import { usePersonas } from '@/hooks/use-personas';
import { useActiveBusiness } from '@/hooks/useActiveBusiness';

// Dynamic imports for heavy components (code-split)
const ContentScoreWidget = dynamic(
  () =>
    import('@/components/content/ContentScoreWidget').then(m => ({
      default: m.ContentScoreWidget,
    })),
  { ssr: false }
);
const AIHashtagGenerator = dynamic(
  () =>
    import('@/components/AIHashtagGenerator').then(m => ({
      default: m.AIHashtagGenerator,
    })),
  { ssr: false }
);

export default function ContentPage() {
  // Multi-business context
  const { businesses, activeBusiness, isOwner, switchBusiness } =
    useActiveBusiness();

  // Fetch personas from API
  const { personas: apiPersonas, loading: personasLoading } = usePersonas();

  // Transform personas for GenerationSettings (only active ones)
  const personas = useMemo(() => {
    return apiPersonas
      .filter(p => p.status === 'active')
      .map(p => ({ id: p.id, name: p.name }));
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
  const [generatedContent, setGeneratedContent] =
    useState<GeneratedContentData | null>(null);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);
  const [psychologyScore, setPsychologyScore] = useState<{
    overallScore: number;
    topPrinciples: { name: string; strength: number }[];
    predictedEngagement: { level: string };
  } | null>(null);
  const [engagementPrediction, setEngagementPrediction] = useState<{
    likes: number;
    comments: number;
    shares: number;
    reach: number;
    engagementRate: number;
    confidence: number;
    factors: {
      factor: string;
      impact: 'positive' | 'neutral' | 'negative';
      weight: number;
    }[];
    recommendations: string[];
  } | null>(null);
  const [predictingEngagement, setPredictingEngagement] = useState(false);

  // Media attachments
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);

  // Video generation modal
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // Publish confirmation modal
  const [publishModalOpen, setPublishModalOpen] = useState(false);

  // Multi-platform state
  const [multiPlatformEnabled, setMultiPlatformEnabled] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'twitter',
  ]);
  const [platformAdaptations, setPlatformAdaptations] = useState<
    Record<string, string>
  >({});
  const [isAdapting, setIsAdapting] = useState(false);

  // Post status tracking (populated after multi-platform schedule)
  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  // Bulk schedule wizard
  const [bulkWizardOpen, setBulkWizardOpen] = useState(false);

  // Industry Mode state
  const [industryModeOpen, setIndustryModeOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [industryScore, setIndustryScore] = useState<{
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    suggestions: string[];
  } | null>(null);
  const [isGeneratingIndustry, setIsGeneratingIndustry] = useState(false);

  // SWR fetcher (credentials included per project convention)
  const fetchJson = useCallback(
    (url: string) => fetch(url, { credentials: 'include' }).then(r => r.json()),
    []
  );

  // Fetch templates for the selected industry
  const { data: templatesData } = useSWR<{
    templates: Array<{
      id: string;
      scenarioName: string;
      exampleOutput: string | null;
    }>;
  }>(
    selectedIndustry
      ? `/api/content/industry/templates?industry=${encodeURIComponent(selectedIndustry)}`
      : null,
    fetchJson
  );
  const industryTemplates = useMemo(
    () => templatesData?.templates ?? [],
    [templatesData]
  );

  // Auto-save drafts every 30s when content exists
  useAutoSave({
    data: generatedContent
      ? {
          topic,
          platform,
          tone,
          content: editMode ? editedContent : generatedContent.primary,
          hashtags: generatedContent.metadata?.hashtags,
        }
      : null,
    onSave: async draft => {
      if (!draft) return;
      await fetchWithCSRF('/api/content-drafts', {
        method: 'POST',
        body: JSON.stringify({
          platform: draft.platform,
          content: draft.content,
          title: draft.topic || `${draft.platform} post`,
          hashtags: draft.hashtags || [],
          tone: draft.tone || tone,
          autoSaved: true,
        }),
      });
    },
    interval: 30000,
    enabled: !!generatedContent,
    storageKey: 'synthex-content-draft',
  });

  const handleGenerate = useCallback(async () => {
    if (!topic) {
      toast.error('Please enter a topic');
      return;
    }

    setIsGenerating(true);
    setPsychologyScore(null);
    setEngagementPrediction(null);
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (
          errorData.code === 'API_KEY_REQUIRED' ||
          errorData.code === 'API_KEY_NOT_CONFIGURED'
        ) {
          toast.error(
            'Please configure an AI API key in Settings → AI Credentials'
          );
          return;
        }
        throw new Error(
          errorData.error ||
            errorData.message ||
            `Request failed (${response.status})`
        );
      }
      const data = await response.json();
      if (data.success && data.data) {
        const aiData = data.data;
        const transformedContent: GeneratedContentData = {
          primary: aiData.content,
          variations:
            aiData.variations?.map((v: { content: string }) => v.content) || [],
          metadata: {
            platform: aiData.platform,
            hookType: hookType,
            length: aiData.content?.length || 0,
            estimatedEngagement:
              aiData.estimatedEngagement || aiData.viralScore || 75,
            hashtags: aiData.hashtags || [],
          },
        };
        setGeneratedContent(transformedContent);
        setEditedContent(transformedContent.primary);
        toast.success('Content generated successfully!');

        // Multi-platform: adapt content for secondary platforms
        const secondaryPlatforms = multiPlatformEnabled
          ? selectedPlatforms.filter(p => p !== platform)
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
            if (!crossPostRes.ok) {
              const errData = await crossPostRes.json().catch(() => ({}));
              throw new Error(
                errData.error || `Cross-post failed (${crossPostRes.status})`
              );
            }
            const crossPostData = await crossPostRes.json();
            if (crossPostData.success && crossPostData.variants) {
              const adaptations: Record<string, string> = {
                [platform]: transformedContent.primary,
              };
              for (const variant of crossPostData.variants) {
                adaptations[variant.platform] = variant.content;
              }
              setPlatformAdaptations(adaptations);
              toast.success(
                `Content adapted for ${secondaryPlatforms.length} additional platform${secondaryPlatforms.length > 1 ? 's' : ''}`
              );
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
          if (!psychRes.ok) {
            const errData = await psychRes.json().catch(() => ({}));
            throw new Error(
              errData.error || `Psychology analysis failed (${psychRes.status})`
            );
          }
          const psychData = await psychRes.json();
          if (psychData.success && psychData.data?.analysis) {
            setPsychologyScore({
              overallScore: psychData.data.analysis.overallScore,
              topPrinciples:
                psychData.data.analysis.principlesDetected
                  ?.slice(0, 3)
                  .map((p: any) => ({ name: p.name, strength: p.strength })) ||
                [],
              predictedEngagement: psychData.data.analysis.predictedEngagement,
            });
          }
        } catch {
          // Psychology analysis is optional, don't block
        }

        // Predict engagement
        try {
          setPredictingEngagement(true);
          const engRes = await fetch('/api/analytics/predict-engagement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              text: transformedContent.primary,
              platform,
              contentType: 'post',
              hasMedia: mediaUrls.length > 0,
            }),
          });
          if (engRes.ok) {
            const engData = await engRes.json();
            if (engData.prediction) {
              setEngagementPrediction({
                likes: engData.prediction.likes,
                comments: engData.prediction.comments,
                shares: engData.prediction.shares,
                reach: engData.prediction.reach,
                engagementRate: engData.prediction.engagementRate,
                confidence: engData.prediction.confidence,
                factors: engData.factors || [],
                recommendations: engData.recommendations || [],
              });
            }
          }
        } catch {
          // Engagement prediction is optional, don't block
        } finally {
          setPredictingEngagement(false);
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
  }, [
    topic,
    platform,
    tone,
    includeHashtags,
    includeEmojis,
    hookType,
    targetLength,
    personaId,
    multiPlatformEnabled,
    selectedPlatforms,
    mediaUrls,
  ]);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  }, []);

  const handleSave = useCallback(async () => {
    const contentToSave =
      editMode && editedContent
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
          onClick: () => {
            window.location.href = '/dashboard/content/drafts';
          },
        },
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save content'
      );
    }
  }, [
    generatedContent,
    editMode,
    editedContent,
    selectedVariation,
    topic,
    platform,
    tone,
    hookType,
    targetLength,
    mediaUrls,
  ]);

  const handleScheduleClick = useCallback(() => {
    if (!generatedContent) {
      toast.error('Generate content first before scheduling');
      return;
    }
    setPublishModalOpen(true);
  }, [generatedContent]);

  const handlePublishConfirm = useCallback(
    async (options: PublishOptions) => {
      const contentText =
        editMode && editedContent
          ? editedContent
          : generatedContent?.variations?.[selectedVariation] ||
            generatedContent?.primary;

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
        throw new Error(
          (errorData as { message?: string }).message ||
            `Failed to schedule (${response.status})`
        );
      }

      toast.success('Post scheduled! View it in your Schedule page.', {
        action: {
          label: 'View Schedule',
          onClick: () => {
            window.location.href = '/dashboard/schedule';
          },
        },
      });
    },
    [
      generatedContent,
      editMode,
      editedContent,
      selectedVariation,
      personaId,
      psychologyScore,
      mediaUrls,
    ]
  );

  const handleMultiPublishConfirm = useCallback(
    async (options: {
      scheduledAt: string;
      platforms: string[];
      batchId: string;
    }): Promise<PlatformScheduleResult[]> => {
      const results: PlatformScheduleResult[] = [];

      for (const targetPlatform of options.platforms) {
        try {
          const contentText =
            platformAdaptations[targetPlatform] ||
            (editMode && editedContent ? editedContent : null) ||
            generatedContent?.primary ||
            '';

          const response = await fetchWithCSRF('/api/scheduler/posts', {
            method: 'POST',
            body: JSON.stringify({
              content: contentText,
              platform: targetPlatform,
              scheduledAt: options.scheduledAt,
              metadata: {
                hashtags: generatedContent?.metadata?.hashtags || [],
                persona: personaId !== 'none' ? personaId : undefined,
                estimatedEngagement: psychologyScore?.predictedEngagement
                  ? 8
                  : 5,
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
              error:
                (errData as { message?: string }).message ||
                `HTTP ${response.status}`,
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

      const successCount = results.filter(r => r.success).length;
      if (successCount === results.length) {
        setLastBatchId(options.batchId);
        toast.success(`Scheduled to ${successCount} platforms!`, {
          action: {
            label: 'View Schedule',
            onClick: () => {
              window.location.href = '/dashboard/schedule';
            },
          },
        });
      } else if (successCount > 0) {
        setLastBatchId(options.batchId);
        toast.warning(
          `Scheduled ${successCount}/${results.length} platforms. Some failed.`
        );
      } else {
        toast.error('All platform schedules failed.');
      }

      return results;
    },
    [
      platformAdaptations,
      editMode,
      editedContent,
      generatedContent,
      personaId,
      psychologyScore,
      mediaUrls,
    ]
  );

  const handleIndustryGenerate = useCallback(async () => {
    if (!selectedIndustry || !selectedScenarioId) {
      toast.error('Please select an industry and scenario');
      return;
    }

    const selectedTemplate = industryTemplates.find(
      t => t.id === selectedScenarioId
    );
    if (!selectedTemplate) {
      toast.error('Selected template not found');
      return;
    }

    setIsGeneratingIndustry(true);
    setIndustryScore(null);

    try {
      const res = await fetch('/api/content/industry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          industry: selectedIndustry,
          scenarioName: selectedTemplate.scenarioName,
          variables: {},
        }),
      });

      if (!res.ok) {
        const errData: { error?: string } = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `Request failed (${res.status})`);
      }

      const data: {
        content: string;
        score: {
          score: number;
          grade: 'A' | 'B' | 'C' | 'D' | 'F';
          suggestions: string[];
        };
      } = await res.json();

      const transformed = {
        primary: data.content,
        variations: [],
        metadata: {
          platform,
          hookType,
          length: data.content.length,
          estimatedEngagement: data.score.score,
          hashtags: [],
        },
      };

      setGeneratedContent(transformed);
      setEditedContent(transformed.primary);
      setIndustryScore(data.score);
      toast.success('Industry content generated!');
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to generate industry content'
      );
    } finally {
      setIsGeneratingIndustry(false);
    }
  }, [
    selectedIndustry,
    selectedScenarioId,
    industryTemplates,
    platform,
    hookType,
  ]);

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
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4 text-orange-400" />
            <span className="text-sm text-white/40">Creating for:</span>
            <select
              value={activeBusiness?.organizationId ?? ''}
              onChange={async e => {
                try {
                  await switchBusiness(e.target.value || null);
                  toast.success(
                    `Switched to ${businesses.find(b => b.organizationId === e.target.value)?.displayName || businesses.find(b => b.organizationId === e.target.value)?.organizationName}`
                  );
                } catch {
                  toast.error('Failed to switch business');
                }
              }}
              className="bg-white/[0.02] border-[0.5px] border-orange-500/20 rounded-sm px-3 py-1.5 text-sm text-white focus:ring-1 focus:ring-orange-500/30 focus:outline-none appearance-none cursor-pointer"
            >
              {businesses.map(b => (
                <option key={b.organizationId} value={b.organizationId}>
                  {b.displayName || b.organizationName}
                </option>
              ))}
            </select>
          </div>
          {activeBusiness && (
            <span className="text-xs text-white/50">
              {activeBusiness.stats?.activePlatforms ?? 0} platforms connected
            </span>
          )}
        </div>
      )}

      <ContentStats />

      {/* Industry Mode */}
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setIndustryModeOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-white/70 hover:text-white transition-colors"
        >
          <span className="flex items-center gap-2">
            <ChevronDown
              className={`h-4 w-4 text-orange-400 transition-transform ${industryModeOpen ? 'rotate-180' : ''}`}
            />
            Industry Mode
          </span>
          <span className="text-xs text-white/30">
            Generate content from industry-specific templates
          </span>
        </button>

        {industryModeOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-white/[0.05]">
            <div className="grid gap-4 sm:grid-cols-2 pt-4">
              {/* Industry selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="industry-select"
                  className="text-xs text-white/50 font-medium"
                >
                  Industry
                </label>
                <select
                  id="industry-select"
                  value={selectedIndustry}
                  onChange={e => {
                    setSelectedIndustry(e.target.value);
                    setSelectedScenarioId('');
                    setIndustryScore(null);
                  }}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-sm px-3 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500/30 focus:outline-none appearance-none cursor-pointer"
                >
                  <option value="">Select industry…</option>
                  <option value="trades">Trades</option>
                  <option value="cafe">Café / Restaurant</option>
                  <option value="salon">Salon / Beauty</option>
                  <option value="gym">Gym / Fitness</option>
                  <option value="clinic">Medical / Dental Clinic</option>
                  <option value="retail">Retail Shop</option>
                </select>
              </div>

              {/* Scenario selector */}
              <div className="space-y-1.5">
                <label
                  htmlFor="scenario-select"
                  className="text-xs text-white/50 font-medium"
                >
                  Scenario
                </label>
                <select
                  id="scenario-select"
                  value={selectedScenarioId}
                  onChange={e => {
                    setSelectedScenarioId(e.target.value);
                    setIndustryScore(null);
                  }}
                  disabled={!selectedIndustry || industryTemplates.length === 0}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-sm px-3 py-2 text-sm text-white focus:ring-1 focus:ring-orange-500/30 focus:outline-none appearance-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {!selectedIndustry
                      ? 'Select industry first…'
                      : industryTemplates.length === 0
                        ? 'No templates available'
                        : 'Select scenario…'}
                  </option>
                  {industryTemplates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.scenarioName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Generate button + score badge */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleIndustryGenerate}
                disabled={
                  !selectedIndustry ||
                  !selectedScenarioId ||
                  isGeneratingIndustry
                }
                className="px-4 py-2 rounded-sm text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isGeneratingIndustry
                  ? 'Generating…'
                  : 'Generate from template'}
              </button>

              {industryScore && (
                <EngagementBadge
                  score={industryScore.score}
                  grade={industryScore.grade}
                  suggestions={industryScore.suggestions}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Video generation entry point */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GenerateVideoCard onClick={() => setVideoModalOpen(true)} />
      </div>

      <VideoGenerationModal
        open={videoModalOpen}
        onOpenChange={setVideoModalOpen}
      />

      {/* Media attachments */}
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
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

      {/* Content quality score + hashtag generator (shown after content generation) */}
      {generatedContent && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ContentScoreWidget
            content={editMode ? editedContent : generatedContent.primary}
            platform={platform}
          />
          <AIHashtagGenerator
            content={generatedContent.primary}
            platform={platform}
            onHashtagsSelected={tags => {
              if (generatedContent.metadata) {
                setGeneratedContent({
                  ...generatedContent,
                  metadata: {
                    ...generatedContent.metadata,
                    hashtags: tags.map(t => (t.startsWith('#') ? t : `#${t}`)),
                  },
                });
              }
            }}
          />
        </div>
      )}

      {/* Auto-save indicator */}
      {generatedContent && (
        <span
          id="auto-save-indicator"
          className="text-[11px] text-white/50 opacity-0 transition-opacity duration-300"
        >
          Auto-saved
        </span>
      )}

      {/* Schedule More -- opens BulkScheduleWizard pre-filled with current content */}
      {generatedContent && (
        <div className="flex justify-end">
          <button
            onClick={() => setBulkWizardOpen(true)}
            className="flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition-colors"
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
            ? editMode && editedContent
              ? editedContent
              : generatedContent.primary
            : undefined
        }
        initialPlatform={platform}
      />

      {/* Platform preview(s) */}
      {generatedContent && (
        <>
          {multiPlatformEnabled &&
          Object.keys(platformAdaptations).length > 1 ? (
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white/40">
                Platform Previews ({Object.keys(platformAdaptations).length}{' '}
                platforms)
                {isAdapting && (
                  <span className="ml-2 text-orange-400 animate-pulse">
                    Adapting...
                  </span>
                )}
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {selectedPlatforms.map(p => (
                  <div
                    key={p}
                    className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4"
                  >
                    <PlatformPreview
                      platform={p}
                      content={
                        p === platform
                          ? editMode
                            ? editedContent
                            : generatedContent.primary
                          : platformAdaptations[p] || generatedContent.primary
                      }
                      mediaUrls={mediaUrls}
                      hashtags={generatedContent.metadata?.hashtags}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
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
        <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-light text-white flex items-center gap-2">
              <Brain className="h-4 w-4 text-orange-400" />
              Psychology Analysis
            </h3>
            <Link
              href="/dashboard/psychology"
              className="text-xs text-orange-400 hover:text-orange-300"
            >
              Full Analysis →
            </Link>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div
                className={`text-2xl font-bold ${
                  psychologyScore.overallScore >= 70
                    ? 'text-green-400'
                    : psychologyScore.overallScore >= 40
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {psychologyScore.overallScore}
              </div>
              <div className="text-xs text-white/40">Score</div>
            </div>
            <div className="flex-1 flex flex-wrap gap-2">
              {psychologyScore.topPrinciples.map(p => (
                <span
                  key={p.name}
                  className="text-xs bg-orange-500/10 text-orange-300 px-2 py-1 rounded-sm border-[0.5px] border-orange-500/20"
                >
                  {p.name} ({p.strength}%)
                </span>
              ))}
            </div>
            <div
              className={`text-xs px-2 py-1 rounded-sm ${
                psychologyScore.predictedEngagement.level === 'viral'
                  ? 'bg-green-500/20 text-green-400'
                  : psychologyScore.predictedEngagement.level === 'high'
                    ? 'bg-orange-500/20 text-orange-400'
                    : psychologyScore.predictedEngagement.level === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-red-500/20 text-red-400'
              }`}
            >
              {psychologyScore.predictedEngagement.level} engagement
            </div>
          </div>
        </div>
      )}

      <EngagementPrediction
        prediction={engagementPrediction}
        isLoading={predictingEngagement}
      />

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
            : generatedContent?.variations?.[selectedVariation] ||
              generatedContent?.primary ||
              ''
        }
        platform={platform}
        mediaUrls={mediaUrls}
        hashtags={generatedContent?.metadata?.hashtags}
        onConfirm={handlePublishConfirm}
        selectedPlatforms={multiPlatformEnabled ? selectedPlatforms : undefined}
        platformAdaptations={
          multiPlatformEnabled ? platformAdaptations : undefined
        }
        onMultiConfirm={
          multiPlatformEnabled && selectedPlatforms.length > 1
            ? handleMultiPublishConfirm
            : undefined
        }
      />
    </div>
  );
}
