'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SEOFeatureGate } from '@/components/seo';
import { useSubscription } from '@/hooks/useSubscription';
import { useSEODashboardStats } from '@/hooks/useSEODashboardStats';
import { useToast } from '@/hooks/use-toast';
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
  Calendar,
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
  status?: 'available' | 'beta' | 'new';
  comingSoon?: boolean;
}) {
  const { toast } = useToast();

  const cardContent = (
    <div className="group border-[0.5px] border-white/[0.06] hover:border-orange-500/30 bg-white/[0.01] rounded-sm transition-all duration-300 h-full">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="p-3 rounded-sm bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
            <Icon className="w-6 h-6 text-orange-400" />
          </div>
          {status === 'beta' && (
            <span className="px-2 py-1 text-xs bg-orange-500/10 text-orange-400 rounded-sm border-[0.5px] border-orange-500/20">
              Beta
            </span>
          )}
          {status === 'new' && (
            <span className="px-2 py-1 text-xs bg-green-500/10 text-emerald-400 rounded-sm border-[0.5px] border-green-500/20">
              New
            </span>
          )}
          {comingSoon && (
            <span className="px-2 py-1 text-xs bg-white/[0.04] text-white/40 rounded-sm border-[0.5px] border-white/[0.06]">
              Coming Soon
            </span>
          )}
        </div>
        <h3 className="text-base font-light text-white mb-2 group-hover:text-orange-400 transition-colors">
          {title}
        </h3>
        <p className="text-white/40 text-sm leading-relaxed">{description}</p>
        {!comingSoon && (
          <div className="mt-4 flex items-center text-orange-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
            Open Tool
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        )}
      </div>
    </div>
  );

  if (comingSoon) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() =>
          toast({
            title: 'Coming Soon',
            description: `${title} is currently in development`,
          })
        }
        onKeyDown={e =>
          e.key === 'Enter' &&
          toast({
            title: 'Coming Soon',
            description: `${title} is currently in development`,
          })
        }
        className="cursor-pointer"
      >
        {cardContent}
      </div>
    );
  }

  return <Link href={href}>{cardContent}</Link>;
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
    <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="p-2 rounded-sm bg-orange-500/10">
            <Icon className="w-5 h-5 text-orange-400" />
          </div>
          <span
            className={`text-sm font-medium flex items-center gap-1 ${
              trend === 'up'
                ? 'text-emerald-400'
                : trend === 'down'
                  ? 'text-red-400'
                  : 'text-white/40'
            }`}
          >
            {trend === 'up' ? (
              <TrendingUp className="w-4 h-4" />
            ) : trend === 'down' ? (
              <TrendingUp className="w-4 h-4 rotate-180" />
            ) : null}
            {change}
          </span>
        </div>
        <p className="text-2xl font-mono tabular-nums font-light text-white mb-1">
          {value}
        </p>
        <p className="text-white/40 text-sm">{title}</p>
      </div>
    </div>
  );
}

export default function SEODashboardPage() {
  const { subscription, isLoading } = useSubscription();
  const { stats: seoStats, isLoading: statsLoading } = useSEODashboardStats();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
            Optimisation
          </span>
          <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white flex items-center gap-3">
            <Search className="w-7 h-7 text-orange-400" />
            SEO Tools
          </h1>
          <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
            Optimise your content for search engines and AI visibility
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            View Reports
          </Button>
          <Link href="/dashboard/seo/audit">
            <Button className="bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30">
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
            value={
              statsLoading
                ? '—'
                : seoStats?.healthScore?.value != null
                  ? `${seoStats.healthScore.value}/100`
                  : 'N/A'
            }
            change={
              seoStats?.healthScore.change !== null &&
              seoStats?.healthScore.change !== undefined
                ? `${seoStats.healthScore.change >= 0 ? '+' : ''}${seoStats.healthScore.change} since last audit`
                : 'No previous audit'
            }
            icon={Target}
            trend={
              seoStats?.healthScore.change !== null &&
              seoStats?.healthScore.change !== undefined
                ? seoStats.healthScore.change > 0
                  ? 'up'
                  : seoStats.healthScore.change < 0
                    ? 'down'
                    : 'neutral'
                : 'neutral'
            }
          />
          <QuickStatCard
            title="Pages Analysed"
            value={subscription?.usage?.seoPages?.toString() || '0'}
            change={`of ${subscription?.limits?.seoPages === -1 ? 'unlimited' : subscription?.limits?.seoPages || 0}`}
            icon={FileSearch}
            trend="neutral"
          />
          <QuickStatCard
            title="Issues Found"
            value={
              statsLoading
                ? '—'
                : seoStats?.issuesFound?.value != null
                  ? String(seoStats.issuesFound.value)
                  : 'N/A'
            }
            change={
              seoStats?.issuesFound.change !== null &&
              seoStats?.issuesFound.change !== undefined
                ? seoStats.issuesFound.change <= 0
                  ? `${Math.abs(seoStats.issuesFound.change)} fewer since last audit`
                  : `${seoStats.issuesFound.change} more since last audit`
                : 'No previous audit'
            }
            icon={AlertTriangle}
            trend={
              seoStats?.issuesFound.change !== null &&
              seoStats?.issuesFound.change !== undefined
                ? seoStats.issuesFound.change < 0
                  ? 'down'
                  : seoStats.issuesFound.change > 0
                    ? 'up'
                    : 'neutral'
                : 'neutral'
            }
          />
          <QuickStatCard
            title="AI Visibility"
            value={
              statsLoading
                ? '—'
                : seoStats?.aiVisibility?.value != null
                  ? `${seoStats.aiVisibility.value}%`
                  : 'N/A'
            }
            change={
              seoStats?.aiVisibility.change !== null &&
              seoStats?.aiVisibility.change !== undefined
                ? `${seoStats.aiVisibility.change >= 0 ? '+' : ''}${seoStats.aiVisibility.change}% since last analysis`
                : 'No previous analysis'
            }
            icon={Eye}
            trend={
              seoStats?.aiVisibility.change !== null &&
              seoStats?.aiVisibility.change !== undefined
                ? seoStats.aiVisibility.change > 0
                  ? 'up'
                  : seoStats.aiVisibility.change < 0
                    ? 'down'
                    : 'neutral'
                : 'neutral'
            }
          />
        </div>

        {/* SEO Tools Grid */}
        <div>
          <h2 className="text-sm uppercase tracking-[0.2em] text-white/40 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-400" />
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
              title="Technical SEO"
              description="Monitor Core Web Vitals trends, check mobile/desktop parity, and validate robots.txt configuration."
              href="/dashboard/seo/technical"
              icon={Code}
              status="available"
            />
            <SEOToolCard
              title="Search Console"
              description="Search performance analytics, indexing coverage, and sitemap health from Google Search Console."
              href="/dashboard/seo/search-console"
              icon={BarChart3}
              status="available"
            />
            <SEOToolCard
              title="PageSpeed Insights"
              description="Run PageSpeed analysis, monitor Core Web Vitals trends, and track performance improvements over time."
              href="/dashboard/seo/pagespeed"
              icon={Zap}
              status="available"
            />
            <SEOToolCard
              title="Scheduled Audits"
              description="Automate recurring SEO audits with regression alerts and historical tracking."
              href="/dashboard/seo/scheduled-audits"
              icon={Calendar}
              status="new"
            />
            <SEOToolCard
              title="Page Analysis"
              description="Deep dive into single page SEO. Check meta tags, content quality, schema markup, and optimization opportunities."
              href="/dashboard/seo/page"
              icon={Search}
              status="available"
            />
            <SEOToolCard
              title="Schema Markup Manager"
              description="Create, validate, and manage JSON-LD structured data. Extract schemas from URLs, browse templates, and preview rich results."
              href="/dashboard/seo/schema"
              icon={Code}
            />
            <SEOToolCard
              title="GEO Readiness"
              description="Assess content readiness for AI search engines. Track citability scores, passage optimization, and platform-specific readiness."
              href="/dashboard/seo/geo-readiness"
              icon={Globe}
              status="beta"
            />
            <SEOToolCard
              title="GEO / AI Visibility"
              description="Raw GEO analysis engine. Deep-dive into citability scoring, passage extraction, and platform-specific optimization details."
              href="/dashboard/geo"
              icon={Eye}
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
          <h2 className="text-sm uppercase tracking-[0.2em] text-white/40 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-400" />
            Recent Audits
          </h2>
          <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
            <div className="p-6">
              <div className="space-y-4">
                {[
                  {
                    url: 'synthex.social',
                    score: 92,
                    issues: 3,
                    date: 'Today',
                  },
                  {
                    url: 'synthex.social/pricing',
                    score: 87,
                    issues: 5,
                    date: 'Yesterday',
                  },
                  {
                    url: 'synthex.social/features',
                    score: 78,
                    issues: 12,
                    date: '2 days ago',
                  },
                ].map((audit, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white/[0.02] rounded-sm hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-sm flex items-center justify-center font-mono tabular-nums font-light text-lg ${
                          audit.score >= 90
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : audit.score >= 70
                              ? 'bg-orange-500/10 text-orange-400'
                              : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {audit.score}
                      </div>
                      <div>
                        <p className="font-light text-white">{audit.url}</p>
                        <p className="text-sm text-white/40">
                          {audit.issues} issues found
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-white/50">
                        {audit.date}
                      </span>
                      <ArrowRight className="w-4 h-4 text-white/50" />
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty state */}
              {false && (
                <div className="text-center py-12">
                  <Search className="w-12 h-12 text-white/50 mx-auto mb-4" />
                  <h3 className="text-base font-light text-white mb-2">
                    No audits yet
                  </h3>
                  <p className="text-white/40 mb-6">
                    Run your first SEO audit to see results here
                  </p>
                  <Link href="/dashboard/seo/audit">
                    <Button className="bg-orange-500/20 border-[0.5px] border-orange-500/30 text-orange-400 hover:bg-orange-500/30">
                      Start First Audit
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </SEOFeatureGate>
    </div>
  );
}
