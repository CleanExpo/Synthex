'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Image, RefreshCw, Download } from '@/components/icons';

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

interface VisualGalleryProps {
  initialAssets?: VisualAsset[];
}

export function VisualGallery({ initialAssets }: VisualGalleryProps) {
  const [assets, setAssets] = useState<VisualAsset[]>(initialAssets || []);
  const [loading, setLoading] = useState(!initialAssets);

  useEffect(() => {
    if (!initialAssets) {
      fetchAssets();
    }
  }, [initialAssets]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/visuals?limit=20', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setAssets(data.assets || []);
      }
    } catch (err) {
      console.error('Failed to fetch visuals:', err);
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    diagram: 'Diagram',
    plot: 'Data Plot',
    infographic: 'Infographic',
    before_after: 'Before/After',
  };

  return (
    <Card className="bg-white/[0.02] border-white/[0.08]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Image className="h-5 w-5 text-cyan-400" />
            Visual Library
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchAssets} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1,2,3].map(i => <div key={i} className="aspect-video bg-white/5 rounded-lg animate-pulse" />)}
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Image className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No visuals generated yet</p>
            <p className="text-xs mt-1">Use Paper Banana to create diagrams and charts</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <div key={asset.id} className="group relative rounded-lg overflow-hidden border border-white/[0.05] bg-white/[0.02]">
                <div className="aspect-video bg-white/5">
                  <img
                    src={asset.thumbnailUrl || asset.imageUrl}
                    alt={asset.altText || 'Generated visual'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-2">
                  <div className="flex items-center justify-between">
                    <Badge className="bg-white/5 text-gray-400 text-xs">{typeLabels[asset.type] || asset.type}</Badge>
                    {asset.qualityScore && (
                      <span className={`text-xs font-medium ${asset.qualityScore >= 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        Q: {asset.qualityScore}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
