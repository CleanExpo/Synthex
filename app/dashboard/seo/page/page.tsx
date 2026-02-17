'use client';

/**
 * Page Analysis Tool
 * Deep single-page SEO analysis with meta tag, heading, content, and schema checks
 */

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SEOFeatureGate } from '@/components/seo';
import { useToast } from '@/hooks/use-toast';
import {
  Search,
  ArrowLeft,
  Loader2,
  Globe,
  Zap,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileText,
  Image,
  Link as LinkIcon,
  Code,
  Type,
} from '@/components/icons';

interface PageAnalysisResult {
  url: string;
  timestamp: string;
  score: number;
  meta: {
    title: { value: string | null; length: number; status: 'good' | 'warning' | 'error' };
    description: { value: string | null; length: number; status: 'good' | 'warning' | 'error' };
    canonical: string | null;
    robots: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterCard: string | null;
  };
  headings: {
    h1: string[];
    h2: string[];
    h3: string[];
    h4: string[];
    h5: string[];
    h6: string[];
    hasMultipleH1: boolean;
  };
  content: {
    wordCount: number;
    readabilityScore: number;
  };
  images: {
    total: number;
    missingAlt: number;
    largeSizes: number;
  };
  links: {
    internal: number;
    external: number;
    broken: number;
  };
  schema: {
    types: string[];
    valid: boolean;
  };
}

function StatusIcon({ status }: { status: 'good' | 'warning' | 'error' }) {
  if (status === 'good') return <CheckCircle className="w-4 h-4 text-green-400" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
  return <XCircle className="w-4 h-4 text-red-400" />;
}

export default function PageAnalysisPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PageAnalysisResult | null>(null);

  const handleAnalyze = async () => {
    if (!url) {
      toast({ title: 'URL Required', description: 'Please enter a URL to analyze', variant: 'destructive' });
      return;
    }

    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      toast({ title: 'Invalid URL', description: 'Please enter a valid URL', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/seo/page-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.startsWith('http') ? url : `https://${url}` }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');

      setResult(data.analysis);
      toast({ title: 'Analysis Complete', description: `Page score: ${data.analysis.score}/100` });
    } catch (error) {
      toast({
        title: 'Analysis Failed',
        description: error instanceof Error ? error.message : 'Failed to analyze page',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
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
            <Search className="w-8 h-8 text-cyan-400" />
            Page Analysis
          </h1>
          <p className="text-gray-400 mt-1">
            Deep dive into single page SEO performance
          </p>
        </div>
      </div>

      <SEOFeatureGate
        feature="Page Analysis"
        requiredPlan="professional"
        description="Analyze individual pages for meta tags, content quality, schema markup, and optimization opportunities."
      >
        {/* URL Input */}
        <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <Input
                  type="url"
                  placeholder="Enter page URL (e.g., https://example.com/about)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                />
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25"
              >
                {isLoading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</>
                ) : (
                  <><Zap className="w-4 h-4 mr-2" />Analyze Page</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Score Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                <CardContent className="p-6 text-center">
                  <div className={`text-4xl font-bold mb-1 ${
                    result.score >= 80 ? 'text-green-400' : result.score >= 50 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {result.score}
                  </div>
                  <p className="text-gray-400 text-sm">Overall Score</p>
                </CardContent>
              </Card>
              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-white mb-1">{result.content.wordCount}</div>
                  <p className="text-gray-400 text-sm">Words</p>
                </CardContent>
              </Card>
              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-white mb-1">{result.images.total}</div>
                  <p className="text-gray-400 text-sm">Images</p>
                </CardContent>
              </Card>
              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                <CardContent className="p-6 text-center">
                  <div className="text-2xl font-bold text-white mb-1">{result.links.internal + result.links.external}</div>
                  <p className="text-gray-400 text-sm">Links</p>
                </CardContent>
              </Card>
            </div>

            {/* Meta Tags */}
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-cyan-400" />
                  Meta Tags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                  <StatusIcon status={result.meta.title.status} />
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Title Tag ({result.meta.title.length} chars)</p>
                    <p className="text-gray-400 text-sm mt-1 break-all">{result.meta.title.value || 'Not found'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                  <StatusIcon status={result.meta.description.status} />
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">Meta Description ({result.meta.description.length} chars)</p>
                    <p className="text-gray-400 text-sm mt-1 break-all">{result.meta.description.value || 'Not found'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    {result.meta.canonical ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <div>
                      <p className="text-white font-medium text-sm">Canonical</p>
                      <p className="text-gray-400 text-xs truncate max-w-[250px]">{result.meta.canonical || 'Missing'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                    {result.meta.ogTitle ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                    <div>
                      <p className="text-white font-medium text-sm">Open Graph</p>
                      <p className="text-gray-400 text-xs truncate max-w-[250px]">{result.meta.ogTitle || 'Missing'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Heading Structure */}
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Type className="w-5 h-5 text-cyan-400" />
                  Heading Structure
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.headings.hasMultipleH1 && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <p className="text-red-300 text-sm">Multiple H1 tags detected — use only one per page</p>
                  </div>
                )}
                <div className="space-y-2">
                  {(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).map((tag) => {
                    const headings = result.headings[tag];
                    if (headings.length === 0) return null;
                    return (
                      <div key={tag} className="space-y-1">
                        <p className="text-cyan-400 text-xs font-mono uppercase">{tag} ({headings.length})</p>
                        {headings.slice(0, 5).map((h, i) => (
                          <p key={i} className={`text-gray-300 text-sm ${tag === 'h1' ? '' : `ml-${Math.min(parseInt(tag[1]) * 2, 10)}`}`}>
                            {h}
                          </p>
                        ))}
                        {headings.length > 5 && (
                          <p className="text-gray-500 text-xs">...and {headings.length - 5} more</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Images & Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Image className="w-5 h-5 text-cyan-400" />
                    Images
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-400 text-sm">Total images</span>
                    <span className="text-white font-medium">{result.images.total}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-400 text-sm">Missing alt text</span>
                    <span className={`font-medium ${result.images.missingAlt > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {result.images.missingAlt}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <LinkIcon className="w-5 h-5 text-cyan-400" />
                    Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-400 text-sm">Internal links</span>
                    <span className="text-white font-medium">{result.links.internal}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-400 text-sm">External links</span>
                    <span className="text-white font-medium">{result.links.external}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Schema Detection */}
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Code className="w-5 h-5 text-cyan-400" />
                  Schema Markup
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.schema.types.length > 0 && result.schema.types[0] !== 'None detected' ? (
                  <div className="flex flex-wrap gap-2">
                    {result.schema.types.map((type, i) => (
                      <span key={i} className="px-3 py-1 bg-cyan-500/10 text-cyan-400 rounded-full text-sm border border-cyan-500/20">
                        {type}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-yellow-400" />
                    <p className="text-yellow-300 text-sm">No structured data detected — consider adding JSON-LD schema</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!result && !isLoading && (
          <div className="text-center py-16">
            <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-white mb-2">Ready to Analyze</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Enter a page URL above to analyze its SEO elements including meta tags, heading structure, content quality, images, and schema markup.
            </p>
          </div>
        )}
      </SEOFeatureGate>
    </div>
  );
}
