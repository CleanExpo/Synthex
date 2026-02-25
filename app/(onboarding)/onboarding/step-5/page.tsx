'use client';

/**
 * Onboarding Step 5: Business Vetting Results
 *
 * @description Displays health check results for SEO, AEO, GEO, and Social.
 * User reviews and approves results before proceeding to API credentials setup.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnboarding, ProgressIndicator } from '@/components/onboarding';
import type { HealthCheckResult } from '@/lib/vetting/business-vetting';

// ============================================================================
// DATA
// ============================================================================

const STEPS = [
  { id: 1, name: 'Business Identity' },
  { id: 2, name: 'Review Details' },
  { id: 3, name: 'Platforms' },
  { id: 4, name: 'Persona' },
  { id: 5, name: 'Vetting' },
  { id: 6, name: 'API Setup' },
  { id: 7, name: 'Complete' },
];

const HEALTH_CATEGORIES = [
  { key: 'seo', label: 'SEO Health', color: 'from-blue-500 to-blue-600', icon: '🔍' },
  { key: 'aeo', label: 'AI Engine Health', color: 'from-purple-500 to-purple-600', icon: '🤖' },
  { key: 'geo', label: 'Local SEO Health', color: 'from-green-500 to-green-600', icon: '📍' },
  { key: 'social', label: 'Social Presence', color: 'from-pink-500 to-pink-600', icon: '🌐' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function Step5VettingPage() {
  const router = useRouter();
  const { data, triggerVetting, approveVetting, completeStep } = useOnboarding();

  const [isLoading, setIsLoading] = useState(false);
  const [approved, setApproved] = useState(data.vettingApproved);

  // Trigger vetting if not already done
  useEffect(() => {
    if (data.vettingStatus === 'idle' && data.businessName) {
      setIsLoading(true);
      triggerVetting().finally(() => setIsLoading(false));
    }
  }, [data.businessName, data.vettingStatus, triggerVetting]);

  const vettingResult = data.vettingResults;
  const isVettingSuccess = data.vettingStatus === 'success';
  const isVettingError = data.vettingStatus === 'error';

  const handleApprove = () => {
    approveVetting();
    setApproved(true);
  };

  const handleNext = () => {
    completeStep(5);
    router.push('/onboarding/step-6');
  };

  const getScoreColor = (score: number | undefined) => {
    if (!score) return 'text-gray-400';
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-amber-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number | undefined) => {
    if (!score) return 'bg-gray-500/10 border-gray-500/20';
    if (score >= 80) return 'bg-emerald-500/10 border-emerald-500/20';
    if (score >= 60) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={5}
        completedSteps={data.completedSteps}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Zap className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Business Health Checkup</h1>
        <p className="text-gray-400">
          We analyzed your online presence across search, AI engines, local, and social
        </p>
      </div>

      {/* Loading State */}
      {(isLoading || data.vettingStatus === 'loading') && (
        <div className="max-w-2xl mx-auto">
          <div className="p-8 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400/30 animate-ping" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-white">Running health checks...</p>
                <p className="text-sm text-gray-400 mt-1">
                  Analyzing SEO, AI engines, local SEO, and social presence
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {isVettingError && data.vettingError && (
        <div className="max-w-2xl mx-auto">
          <div className="p-6 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-sm">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-red-300">Vetting Failed</p>
                <p className="text-sm text-red-200 mt-1">{data.vettingError}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => triggerVetting()}
                  className="text-red-300 hover:text-red-100 mt-3"
                >
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {isVettingSuccess && vettingResult && !isLoading && (
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Overall Score */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-[#0f172a]/80 to-[#0a1628]/80 border border-cyan-500/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400 mb-1">Overall Health Score</p>
                <p className="text-4xl font-bold text-white">
                  {Math.round(vettingResult.overallScore)}
                  <span className="text-lg text-gray-400">/100</span>
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  {vettingResult.overallScore >= 80 && '🌟 Excellent presence'}
                  {vettingResult.overallScore >= 60 && vettingResult.overallScore < 80 && '✅ Good foundation'}
                  {vettingResult.overallScore >= 40 && vettingResult.overallScore < 60 && '⚠️ Needs improvement'}
                  {vettingResult.overallScore < 40 && '❌ Significant issues'}
                </p>
              </div>
              <div className="text-right">
                <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center font-bold text-2xl ${getScoreBg(vettingResult.overallScore)} ${getScoreColor(vettingResult.overallScore)}`}>
                  {Math.round(vettingResult.overallScore)}
                </div>
              </div>
            </div>
          </div>

          {/* Category Scores */}
          <div className="grid grid-cols-2 gap-4">
            {HEALTH_CATEGORIES.map((cat) => {
              const scoreMap: Record<string, number> = {
                seo: vettingResult.seoScore,
                aeo: vettingResult.aeoScore,
                geo: vettingResult.geoScore,
                social: vettingResult.socialScore,
              };
              const score = scoreMap[cat.key];
              return (
                <div
                  key={cat.key}
                  className={`p-4 rounded-lg border ${getScoreBg(score)} backdrop-blur-sm`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{cat.icon}</span>
                    <span className={`text-2xl font-bold ${getScoreColor(score)}`}>
                      {Math.round(score || 0)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white">{cat.label}</p>
                </div>
              );
            })}
          </div>

          {/* Recommendations */}
          {vettingResult.recommendations && vettingResult.recommendations.length > 0 && (
            <div className="p-6 rounded-xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-sm">
              <div className="space-y-3">
                <p className="font-medium text-amber-300 flex items-center gap-2">
                  <span>💡</span> Recommendations to Improve
                </p>
                <ul className="space-y-2">
                  {vettingResult.recommendations.slice(0, 5).map((rec, idx) => (
                    <li key={idx} className="text-sm text-amber-200 flex gap-2">
                      <span className="text-amber-400 shrink-0">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Details by Category */}
          {vettingResult.seoDetails && (
            <details className="group p-4 rounded-lg bg-[#0a1628]/50 border border-cyan-500/10 cursor-pointer">
              <summary className="flex items-center justify-between font-medium text-white hover:text-cyan-300 transition-colors">
                <span>🔍 SEO Details</span>
                <span className="group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <div className="mt-4 space-y-2 text-sm text-gray-400">
                <p>Mobile Ready: {vettingResult.seoDetails.mobileReady ? '✓' : '✗'}</p>
                <p>Sitemap: {vettingResult.seoDetails.hasSitemap ? '✓' : '✗'}</p>
                <p>Meta Tags: {vettingResult.seoDetails.metaTagsComplete ? '✓' : '✗'}</p>
                <p>Schema Markup: {vettingResult.seoDetails.schemaMarkupPresent ? '✓' : '✗'}</p>
              </div>
            </details>
          )}

          {/* Approval Section */}
          <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/20 backdrop-blur-sm">
            {approved ? (
              <div className="flex items-center gap-3 text-emerald-300">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Vetting approved</span>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Review the health scores above. You can improve these later, but approval
                  is required to continue setup.
                </p>
                <Button
                  onClick={handleApprove}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve Vetting & Continue
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      {!isLoading && isVettingSuccess && (
        <div className="flex justify-between max-w-2xl mx-auto pt-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/onboarding/step-4')}
            className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!approved}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to API Setup
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}
