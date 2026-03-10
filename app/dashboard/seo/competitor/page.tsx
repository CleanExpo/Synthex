'use client';

/**
 * Competitor Pages Tool
 * Generate SEO-optimized comparison and alternatives pages
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import {
  Target,
  ArrowLeft,
  Loader2,
  Zap,
  Copy,
  CheckCircle,
  FileText,
  TrendingUp,
  Users,
} from '@/components/icons';

interface CompetitorPageResult {
  type: 'comparison' | 'alternatives';
  title: string;
  metaDescription: string;
  slug: string;
  outline: Array<{
    heading: string;
    type: 'h2' | 'h3';
    notes: string;
  }>;
  schema: object;
  keywords: string[];
}

export default function CompetitorPagesPage() {
  const { toast } = useToast();
  const [brandName, setBrandName] = useState('');
  const [competitorName, setCompetitorName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CompetitorPageResult[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!brandName || !competitorName) {
      toast({
        title: 'Fields Required',
        description: 'Please enter both your brand name and competitor name',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/seo/competitor', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandName, competitorName }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed');

      setResults(data.pages);
      toast({ title: 'Pages Generated', description: `${data.pages.length} page outlines created` });
    } catch (error) {
      toast({
        title: 'Generation Failed',
        description: error instanceof Error ? error.message : 'Failed to generate pages',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copySchema = async (index: number) => {
    await navigator.clipboard.writeText(JSON.stringify(results[index].schema, null, 2));
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast({ title: 'Copied', description: 'Schema markup copied to clipboard' });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/seo">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Target className="w-8 h-8 text-cyan-400" />
            Competitor Pages
          </h1>
          <p className="text-gray-400 mt-1">
            Generate SEO-optimized comparison and alternatives pages
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="Competitor Pages"
        requiredPlan="professional"
        description="Create SEO-optimized 'X vs Y' comparisons and 'alternatives to X' pages with structured data and keyword targeting."
      >
        {/* Input */}
        <Card className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Your Brand</label>
                <Input
                  placeholder="e.g., Synthex"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Competitor</label>
                <Input
                  placeholder="e.g., Hootsuite"
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
              </div>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
            >
              {isLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" />Generate Pages</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-6">
            {results.map((page, index) => (
              <Card key={index} className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          page.type === 'comparison'
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                        }`}>
                          {page.type === 'comparison' ? 'X vs Y' : 'Alternatives'}
                        </span>
                      </div>
                      <CardTitle className="text-white">{page.title}</CardTitle>
                      <p className="text-gray-400 text-sm mt-1">{page.metaDescription}</p>
                      <p className="text-cyan-400/60 text-xs mt-1 font-mono">/{page.slug}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copySchema(index)}
                      className="border-cyan-500/30 text-cyan-400"
                    >
                      {copiedIndex === index ? (
                        <><CheckCircle className="w-3 h-3 mr-1" />Copied</>
                      ) : (
                        <><Copy className="w-3 h-3 mr-1" />Schema</>
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Content Outline */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400" />
                      Content Outline
                    </h4>
                    <div className="space-y-1.5">
                      {page.outline.map((section, i) => (
                        <div key={i} className={`p-2 bg-white/5 rounded ${section.type === 'h3' ? 'ml-4' : ''}`}>
                          <p className="text-white text-sm font-medium">
                            <span className="text-cyan-400/50 text-xs mr-2">{section.type.toUpperCase()}</span>
                            {section.heading}
                          </p>
                          <p className="text-gray-500 text-xs mt-0.5">{section.notes}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Target Keywords */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-cyan-400" />
                      Target Keywords
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {page.keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-1 bg-white/5 text-gray-300 rounded text-xs">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Generate Competitor Pages</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Enter your brand and a competitor name above to generate SEO-optimized comparison and alternatives page outlines with schema markup.
            </p>
          </div>
        )}
      </SEOFeatureGate>
    </div>
  );
}
