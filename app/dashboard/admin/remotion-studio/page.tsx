'use client';

/**
 * Remotion Studio — God Mode Video Composition Preview
 *
 * Protected by admin/layout.tsx owner guard (isOwnerEmail).
 * Uses @remotion/player for in-browser video preview.
 * Dynamic import with ssr: false — Remotion requires browser APIs.
 *
 * Features:
 * - Composition selector (SocialReel, ExplainerVideo)
 * - Live props editor (title, scenes, colours)
 * - Real-time preview via Remotion Player
 * - Composition metadata display
 */

import { useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Video, Play, Plus, Trash2 } from '@/components/icons';
import { cn } from '@/lib/utils';

import { COMPOSITION_REGISTRY } from '@/lib/remotion/registry';
import { SocialReel } from '@/lib/remotion/compositions/SocialReel';
import { ExplainerVideo } from '@/lib/remotion/compositions/ExplainerVideo';
import type { BaseCompositionProps, SceneProps } from '@/lib/remotion/types';
import { brands, type BrandSlug } from '@unite-group/brand-config';
import { getBrandContent } from '@/lib/remotion/brand-registry';

// ── Dynamic import of Remotion Player (no SSR) ──────────────────────────────

const Player = dynamic(
  () => import('@remotion/player').then(mod => mod.Player),
  { ssr: false }
);

// ── Component map ────────────────────────────────────────────────────────────

const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  SocialReel,
  ExplainerVideo,
};

// ── Page Component ───────────────────────────────────────────────────────────

export default function RemotionStudioPage() {
  const [selectedId, setSelectedId] = useState(COMPOSITION_REGISTRY[0].id);
  const [editProps, setEditProps] = useState<BaseCompositionProps>(() => ({
    ...COMPOSITION_REGISTRY[0].defaultProps,
  }));
  const [selectedBrand, setSelectedBrand] = useState<BrandSlug | ''>('');

  const composition = useMemo(
    () => COMPOSITION_REGISTRY.find(c => c.id === selectedId)!,
    [selectedId]
  );

  const CompositionComponent = COMPONENT_MAP[selectedId];

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCompositionChange = useCallback((id: string) => {
    setSelectedId(id);
    const comp = COMPOSITION_REGISTRY.find(c => c.id === id);
    if (comp) {
      setEditProps({ ...comp.defaultProps });
    }
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    setEditProps(prev => ({ ...prev, title }));
  }, []);

  const handleBrandColourChange = useCallback((brandColour: string) => {
    setEditProps(prev => ({ ...prev, brandColour }));
  }, []);

  // SYN-903: pick a brand from @unite-group/brand-config and autofill the
  // props panel. Always updates brandColour; for brand-aware compositions
  // (BrandShowcase / BrandReel / BrandSquare) additionally fills richer
  // copy fields from BrandContent when available.
  const handleBrandChange = useCallback(
    (slug: BrandSlug) => {
      setSelectedBrand(slug);
      const config = brands[slug];
      if (!config) return;
      const content = getBrandContent(slug); // undefined for external-client (no BrandContent entry)

      setEditProps(prev => {
        const base = {
          ...prev,
          brandColour: config.colour.primary,
          title: content?.brandName ?? config.displayName,
        };

        if (content && selectedId === 'BrandShowcase') {
          return {
            ...base,
            tagline: content.tagline,
            valueProps: content.valueProps,
            websiteUrl: content.websiteUrl,
            industry: content.industry,
          } as BaseCompositionProps;
        }
        if (content && selectedId === 'BrandReel') {
          return {
            ...base,
            hookText: content.hookText,
            benefit: content.benefit,
            ctaText: content.ctaText,
          } as BaseCompositionProps;
        }
        if (content && selectedId === 'BrandSquare') {
          return {
            ...base,
            problem: content.problem,
            solution: content.solution,
            ctaText: content.ctaText,
          } as BaseCompositionProps;
        }
        return base;
      });
    },
    [selectedId]
  );

  const handleSceneTextChange = useCallback((index: number, text: string) => {
    setEditProps(prev => ({
      ...prev,
      scenes: prev.scenes.map((s, i) => (i === index ? { ...s, text } : s)),
    }));
  }, []);

  const handleSceneSubtitleChange = useCallback(
    (index: number, subtitle: string) => {
      setEditProps(prev => ({
        ...prev,
        scenes: prev.scenes.map((s, i) =>
          i === index ? { ...s, subtitle } : s
        ),
      }));
    },
    []
  );

  const handleAddScene = useCallback(() => {
    setEditProps(prev => ({
      ...prev,
      scenes: [...prev.scenes, { text: 'New scene', duration: 60 }],
    }));
  }, []);

  const handleRemoveScene = useCallback((index: number) => {
    setEditProps(prev => ({
      ...prev,
      scenes: prev.scenes.filter((_, i) => i !== index),
    }));
  }, []);

  // Calculate total duration from scenes
  const totalDuration = useMemo(() => {
    const titleFrames = selectedId === 'SocialReel' ? 30 : 60;
    return (
      titleFrames + editProps.scenes.reduce((sum, s) => sum + s.duration, 0)
    );
  }, [editProps.scenes, selectedId]);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-orange-500/10">
            <Video className="h-6 w-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">
              Remotion Studio
            </h1>
            <p className="text-sm text-gray-300">
              Programmatic video composition preview
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="border-orange-500/30 text-orange-400"
        >
          God Mode
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor */}
        <div className="space-y-4">
          {/* Composition Selector */}
          <Card variant="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Composition</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedId}
                onValueChange={handleCompositionChange}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPOSITION_REGISTRY.map(comp => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name} — {comp.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-3 mt-3 text-[11px] text-gray-500">
                <span>
                  {composition.width}×{composition.height}
                </span>
                <span>{composition.fps}fps</span>
                <span>{(totalDuration / composition.fps).toFixed(1)}s</span>
              </div>
            </CardContent>
          </Card>

          {/* Brand selector — autofills props panel from @unite-group/brand-config (SYN-903) */}
          <Card variant="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Brand</CardTitle>
              <CardDescription className="text-[11px]">
                Pick a brand to autofill colour and copy from
                @unite-group/brand-config.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedBrand}
                onValueChange={value => handleBrandChange(value as BrandSlug)}
              >
                <SelectTrigger className="bg-white/5 border-white/10">
                  <SelectValue placeholder="Pick a brand…" />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(brands).map(b => (
                    <SelectItem key={b.slug} value={b.slug}>
                      {b.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Title + Brand Colour */}
          <Card variant="glass">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Properties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs text-gray-300 mb-1 block">
                  Title
                </label>
                <input
                  type="text"
                  value={editProps.title}
                  onChange={e => handleTitleChange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-300 mb-1 block">
                  Brand Colour
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={editProps.brandColour || '#f59e0b'}
                    onChange={e => handleBrandColourChange(e.target.value)}
                    className="w-8 h-8 rounded border border-white/10 bg-transparent cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editProps.brandColour || '#f59e0b'}
                    onChange={e => handleBrandColourChange(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scenes Editor */}
          <Card variant="glass">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Scenes ({editProps.scenes.length})
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-orange-400 hover:text-orange-300"
                  onClick={handleAddScene}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Scene
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {editProps.scenes.map((scene: SceneProps, i: number) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.08] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 font-mono">
                      Scene {i + 1} · {(scene.duration / 30).toFixed(1)}s
                    </span>
                    {editProps.scenes.length > 1 && (
                      <button
                        onClick={() => handleRemoveScene(i)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={scene.text}
                    onChange={e => handleSceneTextChange(i, e.target.value)}
                    placeholder="Scene text"
                    className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-orange-500/50"
                  />
                  <input
                    type="text"
                    value={scene.subtitle || ''}
                    onChange={e => handleSceneSubtitleChange(i, e.target.value)}
                    placeholder="Subtitle (optional)"
                    className="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white/60 focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          <Card variant="glass">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-orange-400" />
                  <CardTitle className="text-sm">Preview</CardTitle>
                </div>
                <CardDescription className="text-[11px]">
                  {composition.name}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'rounded-lg overflow-hidden border border-white/[0.08] bg-black',
                  composition.width > composition.height
                    ? 'aspect-video'
                    : 'aspect-[9/16] max-h-[600px] mx-auto'
                )}
              >
                {CompositionComponent && (
                  <Player
                    component={CompositionComponent}
                    inputProps={editProps}
                    durationInFrames={totalDuration}
                    fps={composition.fps}
                    compositionWidth={composition.width}
                    compositionHeight={composition.height}
                    style={{ width: '100%', height: '100%' }}
                    controls
                    autoPlay
                    loop
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Composition Info */}
          <Card variant="glass">
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">Resolution</span>
                  <p className="text-white font-mono">
                    {composition.width}×{composition.height}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Frame Rate</span>
                  <p className="text-white font-mono">{composition.fps} fps</p>
                </div>
                <div>
                  <span className="text-gray-500">Duration</span>
                  <p className="text-white font-mono">
                    {(totalDuration / composition.fps).toFixed(1)}s (
                    {totalDuration} frames)
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Scenes</span>
                  <p className="text-white font-mono">
                    {editProps.scenes.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
