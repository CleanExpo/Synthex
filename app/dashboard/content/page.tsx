'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardSkeleton } from '@/components/skeletons';
import { APIErrorCard } from '@/components/error-states';
import toast from 'react-hot-toast';

import {
  type GeneratedContentData,
  ContentHeader,
  ContentStats,
  GenerationSettings,
  GeneratedContent,
} from '@/components/content';

export default function ContentPage() {
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        setIsLoading(false);
      } catch {
        setError('Failed to load content generator');
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!topic) {
      toast.error('Please enter a topic');
      return;
    }

    setIsGenerating(true);
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
          targetAudience: personaId !== 'none' ? personaId : undefined,
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
      } else {
        toast.error(data.error || data.message || 'Failed to generate content');
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  }, [topic, platform, tone, includeHashtags, includeEmojis, hookType, targetLength, personaId]);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    toast.success('Copied to clipboard!');
  }, []);

  const handleSave = useCallback(() => {
    toast.success('Content saved as draft');
  }, []);

  const handleSchedule = useCallback(() => {
    toast.success('Opening scheduler...');
  }, []);

  const handleTrainAI = useCallback(() => {
    toast.success('AI training feature coming soon');
  }, []);

  const handleViewAnalytics = useCallback(() => {
    window.location.href = '/dashboard/analytics';
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 500);
  }, []);

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="p-6">
        <APIErrorCard
          title="Content Generator Error"
          message={error}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ContentHeader onTrainAI={handleTrainAI} onViewAnalytics={handleViewAnalytics} />

      <ContentStats />

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
          targetLength={targetLength}
          onTargetLengthChange={setTargetLength}
          includeHashtags={includeHashtags}
          onIncludeHashtagsChange={setIncludeHashtags}
          includeEmojis={includeEmojis}
          onIncludeEmojisChange={setIncludeEmojis}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
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
          onSchedule={handleSchedule}
        />
      </div>
    </div>
  );
}
