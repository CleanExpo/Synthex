'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Image,
  Plus,
  RefreshCw,
  Sparkles,
} from '@/components/icons';
import { GEOFeatureGate } from '@/components/geo/GEOFeatureGate';

interface VisualAsset {
  id: number;
  type: string;
  imageUrl: string;
  thumbnailUrl?: string;
  qualityScore?: number;
  altText?: string;
  caption?: string;
  status: string;
  createdAt: string;
}

export default function VisualsPage() {
  const [assets, setAssets] = useState<VisualAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genForm, setGenForm] = useState({ type: 'diagram', prompt: '' });
  const [generating, setGenerating] = useState(false);

  useEffect(() => { fetchAssets(); }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/visuals?limit=30', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const generate = async () => {
    if (genForm.prompt.length < 10) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/visuals/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(genForm),
      });
      if (res.ok) {
        setShowGenerate(false);
        setGenForm({ type: 'diagram', prompt: '' });
        fetchAssets();
      }
    } catch (err) { console.error(err); } finally { setGenerating(false); }
  };

  const typeLabels: Record<string, string> = {
    diagram: 'Diagram', plot: 'Data Plot', infographic: 'Infographic', before_after: 'Before/After',
  };

  return (
    <GEOFeatureGate
      feature="Visual Library"
      requiredPlan="professional"
      description="Generate publication-quality academic diagrams and data visualizations with Paper Banana AI."
      benefits={[
        'AI-generated concept diagrams and data plots',
        'Before/after comparison galleries',
        'Quality evaluation with Critic agent scoring',
      ]}
    >
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Image className="h-7 w-7 text-cyan-400" />
            Visual Library
          </h1>
          <p className="text-gray-400 mt-1">Paper Banana AI-generated academic diagrams and visualizations</p>
        </div>
        <Button onClick={() => setShowGenerate(!showGenerate)} className="bg-cyan-600 hover:bg-cyan-700">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Visual
        </Button>
      </div>

      {showGenerate && (
        <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
          <CardContent className="p-6 space-y-4">
            <select
              value={genForm.type}
              onChange={(e) => setGenForm({ ...genForm, type: e.target.value })}
              className="bg-white/5 border border-white/10 text-white rounded-lg px-3 py-2 text-sm w-full"
            >
              <option value="diagram">Concept Diagram</option>
              <option value="plot">Data Plot</option>
              <option value="infographic">Infographic</option>
              <option value="before_after">Before/After Comparison</option>
            </select>
            <textarea
              value={genForm.prompt}
              onChange={(e) => setGenForm({ ...genForm, prompt: e.target.value })}
              placeholder="Describe the visual you want to generate..."
              className="w-full h-24 bg-white/5 border border-white/10 text-white rounded-lg px-4 py-2 text-sm placeholder:text-gray-500 resize-y"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button onClick={generate} disabled={generating || genForm.prompt.length < 10} className="bg-cyan-600 hover:bg-cyan-700">
                {generating ? <><RefreshCw className="h-4 w-4 animate-spin mr-2" />Generating...</> : 'Generate'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="aspect-video bg-white/5 rounded-lg animate-pulse" />)}
        </div>
      ) : assets.length === 0 ? (
        <Card className="bg-[#0f172a]/80 border border-cyan-500/10">
          <CardContent className="p-12 text-center text-gray-400">
            <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No visuals generated yet</p>
            <p className="text-sm mt-1">Use Paper Banana to create publication-quality diagrams</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="bg-[#0f172a]/80 border border-cyan-500/10 overflow-hidden group hover:border-cyan-500/30 transition-all">
              <div className="aspect-video bg-white/5 relative">
                <img src={asset.thumbnailUrl || asset.imageUrl} alt={asset.altText || ''} className="w-full h-full object-cover" loading="lazy" />
                {asset.qualityScore !== null && asset.qualityScore !== undefined && (
                  <div className="absolute top-2 right-2">
                    <Badge className={`${asset.qualityScore >= 70 ? 'bg-emerald-500/80' : 'bg-amber-500/80'} text-white text-xs`}>
                      Q: {asset.qualityScore}
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-white/5 text-gray-400 text-xs">{typeLabels[asset.type] || asset.type}</Badge>
                  <Badge className={`text-xs ${asset.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>{asset.status}</Badge>
                </div>
                {asset.caption && <p className="text-xs text-gray-500 mt-1 line-clamp-1">{asset.caption}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
    </GEOFeatureGate>
  );
}
