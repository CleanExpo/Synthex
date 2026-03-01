'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Zap, TrendingUp } from '@/components/icons';
import { fetchWithCSRF } from '@/lib/csrf';
import { toast } from 'sonner';

import { ContentConfigForm } from './ContentConfigForm';
import { GeneratedContentDisplay } from './GeneratedContentDisplay';
import { ContentHistory } from './ContentHistory';
import type { GeneratedContent, Business, ConnectionStatus, ContentFormData } from './types';

export function AIContentStudio() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [selectedVariation, setSelectedVariation] = useState(0);
  const [copiedContent, setCopiedContent] = useState('');

  const [formData, setFormData] = useState<ContentFormData>({
    type: 'post',
    platform: 'twitter',
    topic: '',
    tone: 'professional',
    keywords: '',
    targetAudience: '',
    length: 'medium',
    includeEmojis: true,
    includeHashtags: true,
    includeCTA: false
  });

  const [contentHistory, setContentHistory] = useState<GeneratedContent[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [connectedPlatforms, setConnectedPlatforms] = useState<Set<string>>(new Set());
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingConnections, setLoadingConnections] = useState(false);

  // Fetch user's businesses on mount
  useEffect(() => {
    async function fetchBusinesses() {
      try {
        const res = await fetch('/api/businesses');
        if (res.ok) {
          const data = await res.json();
          const biz: Business[] = (data.businesses || []).map((b: Record<string, unknown>) => ({
            organizationId: b.organizationId as string,
            organizationName: b.organizationName as string,
            displayName: b.displayName as string | null,
          }));
          setBusinesses(biz);
          const active = data.activeBusiness as string | null;
          if (active && biz.some(b => b.organizationId === active)) {
            setSelectedBusinessId(active);
          } else if (biz.length === 1) {
            setSelectedBusinessId(biz[0].organizationId);
          }
        }
      } catch {
        // Silently fail — personal account mode
      } finally {
        setLoadingBusinesses(false);
      }
    }
    fetchBusinesses();
  }, []);

  // Fetch connections when selected business changes
  useEffect(() => {
    if (!selectedBusinessId) {
      setConnectedPlatforms(new Set());
      return;
    }
    async function fetchConnections() {
      setLoadingConnections(true);
      try {
        const res = await fetch(`/api/auth/connections?organizationId=${selectedBusinessId}`);
        if (res.ok) {
          const data = await res.json();
          const connected = new Set<string>(
            ((data.connections || []) as ConnectionStatus[])
              .filter((c) => c.connected)
              .map((c) => c.platform.toLowerCase())
          );
          setConnectedPlatforms(connected);
          if (connected.size > 0 && !connected.has(formData.platform)) {
            const firstConnected = Array.from(connected)[0];
            if (firstConnected) {
              setFormData(prev => ({ ...prev, platform: firstConnected }));
            }
          }
        }
      } catch {
        setConnectedPlatforms(new Set());
      } finally {
        setLoadingConnections(false);
      }
    }
    fetchConnections();
  }, [selectedBusinessId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = async () => {
    if (!formData.topic && !formData.keywords) {
      toast.error('Please provide a topic or keywords');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetchWithCSRF('/api/ai/generate-content', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          keywords: formData.keywords ? formData.keywords.split(',').map(k => k.trim()) : []
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate content');
      }

      const result = await response.json();
      setGeneratedContent(result.data);
      setContentHistory(prev => [result.data, ...prev].slice(0, 10));
      setSelectedVariation(0);
      toast.success('Content generated successfully!');
    } catch (error) {
      console.error('Generation error:', error);
      toast.error('Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContent(type);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedContent(''), 2000);
  };

  const downloadContent = () => {
    if (!generatedContent) return;
    const content = selectedVariation === 0
      ? generatedContent.content
      : generatedContent.variations[selectedVariation - 1].content;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.platform}-content-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Content downloaded!');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold gradient-text">AI Content Studio</h2>
          <p className="text-gray-400 mt-2">Generate viral content with AI-powered creativity</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-cyan-500 text-cyan-400">
            <Zap className="w-3 h-3 mr-1" />
            AI Powered
          </Badge>
          <Badge variant="outline" className="border-green-500 text-green-400">
            <TrendingUp className="w-3 h-3 mr-1" />
            Viral Optimized
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ContentConfigForm
          formData={formData}
          setFormData={setFormData as any}
          businesses={businesses}
          selectedBusinessId={selectedBusinessId}
          setSelectedBusinessId={setSelectedBusinessId}
          connectedPlatforms={connectedPlatforms}
          loadingBusinesses={loadingBusinesses}
          loadingConnections={loadingConnections}
          isGenerating={isGenerating}
          onGenerate={handleGenerate}
        />

        <GeneratedContentDisplay
          generatedContent={generatedContent}
          selectedVariation={selectedVariation}
          setSelectedVariation={setSelectedVariation}
          copiedContent={copiedContent}
          platform={formData.platform}
          onCopy={copyToClipboard}
          onDownload={downloadContent}
          onRegenerate={handleGenerate}
        />
      </div>

      <ContentHistory
        contentHistory={contentHistory}
        copiedContent={copiedContent}
        onSelectContent={(item) => {
          setGeneratedContent(item);
          setSelectedVariation(0);
        }}
        onCopy={copyToClipboard}
      />
    </div>
  );
}

export default AIContentStudio;
