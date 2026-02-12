'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SEOFeatureGate } from '@/components/seo';
import { useSubscription } from '@/hooks/useSubscription';
import {
  Search,
  FileSearch,
  Code,
  Globe,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Zap,
  Target,
  FileCode,
  Map,
  Languages,
  Eye,
} from '@/components/icons';

// SEO Tool Card Component
function SEOToolCard({
  title,
  description,
  href,
  icon: Icon,
  status,
  comingSoon,
}: {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  status?: 'available' | 'beta';
  comingSoon?: boolean;
}) {
  return (
    <Link href={comingSoon ? '#' : href} className={comingSoon ? 'cursor-not-allowed' : ''}>
      <Card className="group bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300 h-full">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-xl bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors">
              <Icon className="w-6 h-6 text-cyan-400" />
            </div>
            {status === 'beta' && (
              <span className="px-2 py-1 text-xs font-medium bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/20">
                Beta
              </span>
            )}
            {comingSoon && (
              <span className="px-2 py-1 text-xs font-medium bg-gray-500/10 text-gray-400 rounded-full border border-gray-500/20">
                Coming Soon
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-cyan-400 transition-colors">
            {title}
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            {description}
          </p>
          {!comingSoon && (
            <div className="mt-4 flex items-center text-cyan-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Open Tool
              <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

// Quick Stats Card Component
function QuickStatCard({
  title,
  value,
  change,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  change: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Icon className="w-5 h-5 text-cyan-400" />
          </div>
          <span className={`text-sm font-medium flex items-center gap-1 ${
            trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : trend === 'down' ? <TrendingUp className="w-4 h-4 rotate-180" /> : null}
            {change}
          </span>
        </div>
        <p className="text-2xl font-bold text-white mb-1">{value}</p>
        <p className="text-gray-400 text-sm">{title}</p>
      </CardContent>
    </Card>
  );
}

export default function SEODashboardPage() {
  const { subscription, isLoading } = useSubscription();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Search className="w-8 h-8 text-cyan-400" />
            SEO Tools
          </h1>
          <p className="text-gray-400 mt-2">
            Optimize your content for search engines and AI visibility
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
            <BarChart3 className="w-4 h-4 mr-2" />
            View Reports
          </Button>
          <Link href="/dashboard/seo/audit">
            <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25">
              <Zap className="w-4 h-4 mr-2" />
              New Audit
            </Button>
          </Link>
        </div>
      </div>

      {/* Feature Gate for the entire dashboard */}
      <SEOFeatureGate
        feature="SEO Tools Dashboard"
        requiredPlan="professional"
        description="Access comprehensive SEO analysis tools, schema generators, and AI visibility optimization to boost your content's search ranking."
      >
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <QuickStatCard
            title="SEO Health Score"
            value="85/100"
            change="+5 this month"
            icon={Target}
            trend="up"
          />
          <QuickStatCard
            title="Pages Analyzed"
            value={subscription?.usage?.seoPages?.toString() || '0'}
            change={`of ${subscription?.limits?.seoPages === -1 ? 'unlimited' : subscription?.limits?.seoPages || 0}`}
            icon={FileSearch}
            trend="neutral"
          />
          <QuickStatCard
            title="Issues Found"
            value="23"
            change="-8 fixed"
            icon={AlertTriangle}
            trend="down"
          />
          <QuickStatCard
            title="AI Visibility"
            value="72%"
            change="+12% this week"
            icon={Eye}
            trend="up"
          />
        </div>

        {/* SEO Tools Grid */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            Available Tools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <SEOToolCard
              title="Site Audit"
              description="Comprehensive SEO health check. Analyze crawlability, indexability, Core Web Vitals, and technical issues."
              href="/dashboard/seo/audit"
              icon={FileSearch}
              status="available"
            />
            <SEOToolCard
              title="Page Analysis"
              description="Deep dive into single page SEO. Check meta tags, content quality, schema markup, and optimization opportunities."
              href="/dashboard/seo/page"
              icon={Search}
              status="available"
            />
            <SEOToolCard
              title="Schema Generator"
              description="Generate and validate JSON-LD structured data for Organization, Product, Article, FAQ, and more."
              href="/dashboard/seo/schema"
              icon={Code}
            />
            <SEOToolCard
              title="GEO / AI Visibility"
              description="Optimize for AI Overviews, ChatGPT, and Perplexity. Analyze brand mentions and AI crawler accessibility."
              href="/dashboard/seo/geo"
              icon={Globe}
              status="beta"
            />
            <SEOToolCard
              title="Sitemap Analyzer"
              description="Validate XML sitemaps, check URL structure, and generate optimized sitemaps for your site."
              href="/dashboard/seo/sitemap"
              icon={Map}
            />
            <SEOToolCard
              title="Competitor Pages"
              description="Create SEO-optimized comparison and alternatives pages with feature matrices and conversion optimization."
              href="/dashboard/seo/competitor"
              icon={Target}
            />
            <SEOToolCard
              title="Hreflang Checker"
              description="Audit international SEO implementation. Validate language tags and multi-region targeting."
              href="/dashboard/seo/hreflang"
              icon={Languages}
              comingSoon
            />
            <SEOToolCard
              title="Content Optimizer"
              description="AI-powered content analysis with E-E-A-T scoring and readability improvements."
              href="/dashboard/seo/content"
              icon={FileCode}
              comingSoon
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Recent Audits
          </h2>
          <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10">
            <CardContent className="p-6">
              <div className="space-y-4">
                {[
                  { url: 'synthex.social', score: 92, issues: 3, date: 'Today' },
                  { url: 'synthex.social/pricing', score: 87, issues: 5, date: 'Yesterday' },
                  { url: 'synthex.social/features', score: 78, issues: 12, date: '2 days ago' },
                ].map((audit, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${
                        audit.score >= 90 ? 'bg-green-500/20 text-green-400' :
                        audit.score >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {audit.score}
                      </div>
                      <div>
                        <p className="font-medium text-white">{audit.url}</p>
                        <p className="text-sm text-gray-400">{audit.issues} issues found</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">{audit.date}</span>
                      <ArrowRight className="w-4 h-4 text-gray-500" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty state */}
              {false && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No audits yet</h3>
                  <p className="text-gray-400 mb-6">Run your first SEO audit to see results here</p>
                  <Link href="/dashboard/seo/audit">
                    <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500">
                      Start First Audit
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </SEOFeatureGate>
    </div>
  );
}
