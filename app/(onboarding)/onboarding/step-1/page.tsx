'use client';

/**
 * Onboarding Step 1: Your Business
 *
 * UNI-1150: Combined business identity + details into a single step.
 * Collects: Business Name (required), Website URL (optional, triggers AI analysis),
 * Industry (required), Team Size (required), Description (optional).
 *
 * If a website URL is provided, AI analysis runs in the background and pre-populates
 * industry, team size, and description fields. Users can always override.
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOnboarding, ProgressIndicator, ONBOARDING_STEPS } from '@/components/onboarding';

// ============================================================================
// CONSTANTS
// ============================================================================

const INDUSTRIES = [
  { value: 'technology', label: 'Technology' },
  { value: 'ecommerce', label: 'E-Commerce / Retail' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance / Banking' },
  { value: 'education', label: 'Education' },
  { value: 'entertainment', label: 'Entertainment / Media' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'travel', label: 'Travel & Hospitality' },
  { value: 'realestate', label: 'Real Estate' },
  { value: 'nonprofit', label: 'Non-Profit' },
  { value: 'agency', label: 'Marketing Agency' },
  { value: 'construction', label: 'Construction / Trades' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'other', label: 'Other' },
];

const TEAM_SIZES = [
  { value: 'solo', label: 'Just me' },
  { value: 'small', label: '2-10 people' },
  { value: 'medium', label: '11-50 people' },
  { value: 'large', label: '51-200 people' },
  { value: 'enterprise', label: '200+ people' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function Step1BusinessPage() {
  const router = useRouter();
  const { data, setBusinessIdentity, setReviewedDetails, triggerAnalysis, completeStep } = useOnboarding();

  // Local form state — pre-populated from context if returning to this step
  const [businessName, setBusinessName] = useState(data.businessName || '');
  const [websiteUrl, setWebsiteUrl] = useState(data.websiteUrl || '');
  const [industry, setIndustry] = useState(data.industry || '');
  const [teamSize, setTeamSize] = useState(data.teamSize || '');
  const [description, setDescription] = useState(data.description || '');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(!!data.aiAnalysis);

  // Sync AI analysis results back to local state when they arrive
  useEffect(() => {
    if (data.analysisStatus === 'success' && data.aiAnalysis && !analyzed) {
      setAnalyzed(true);
      setAnalyzing(false);
      // Pre-populate from AI only if fields are still empty
      if (!industry && data.industry) setIndustry(data.industry);
      if (!teamSize && data.teamSize) setTeamSize(data.teamSize);
      if (!description && data.description) setDescription(data.description);
    }
    if (data.analysisStatus === 'error') {
      setAnalyzing(false);
    }
  }, [data.analysisStatus, data.aiAnalysis, data.industry, data.teamSize, data.description, industry, teamSize, description, analyzed]);

  // Trigger AI analysis when website URL is provided and user tabs away
  const handleWebsiteBlur = () => {
    if (websiteUrl && businessName && !analyzed && data.analysisStatus !== 'loading') {
      setBusinessIdentity(businessName, websiteUrl);
      setAnalyzing(true);
      setTimeout(() => {
        triggerAnalysis();
      }, 100);
    }
  };

  const handleNameChange = (name: string) => {
    setBusinessName(name);
  };

  const handleNext = () => {
    // Sync all fields to context
    setBusinessIdentity(businessName, websiteUrl);
    setReviewedDetails({
      industry,
      teamSize,
      description,
      brandColors: data.brandColors || {},
      socialHandles: data.socialHandles || {},
    });
    completeStep(1);
    router.push('/onboarding/step-2');
  };

  const isValid = businessName.trim().length > 0 && industry.length > 0 && teamSize.length > 0;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={ONBOARDING_STEPS}
        currentStep={1}
        completedSteps={data.completedSteps}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Building className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Tell us about your business</h1>
        <p className="text-gray-400">
          We&apos;ll use this to personalise your SYNTHEX experience.
        </p>
      </div>

      {/* Form */}
      <div className="max-w-lg mx-auto space-y-5">
        <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm space-y-5">
          {/* Business Name */}
          <div className="space-y-2">
            <Label htmlFor="businessName" className="text-gray-300">
              Business Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Acme Marketing Co"
              className="bg-[#0a1628]/50 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              autoFocus
            />
          </div>

          {/* Website URL */}
          <div className="space-y-2">
            <Label htmlFor="websiteUrl" className="text-gray-300">
              Website URL
              <span className="text-gray-500 text-xs ml-2">(optional — we&apos;ll auto-detect your details)</span>
            </Label>
            <div className="relative">
              <Input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                onBlur={handleWebsiteBlur}
                placeholder="https://example.com"
                className="bg-[#0a1628]/50 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
              />
              {analyzing && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span className="text-xs text-cyan-400">Analysing...</span>
                </div>
              )}
            </div>
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label className="text-gray-300">
              Industry <span className="text-red-400">*</span>
            </Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger className="bg-[#0a1628]/50 border-cyan-500/20 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20">
                <SelectValue placeholder="Select your industry" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f172a] border-cyan-500/20">
                {INDUSTRIES.map((ind) => (
                  <SelectItem
                    key={ind.value}
                    value={ind.value}
                    className="text-gray-300 focus:bg-cyan-500/20 focus:text-white"
                  >
                    {ind.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team Size */}
          <div className="space-y-2">
            <Label className="text-gray-300">
              Team Size <span className="text-red-400">*</span>
            </Label>
            <Select value={teamSize} onValueChange={setTeamSize}>
              <SelectTrigger className="bg-[#0a1628]/50 border-cyan-500/20 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20">
                <SelectValue placeholder="How big is your team?" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f172a] border-cyan-500/20">
                {TEAM_SIZES.map((size) => (
                  <SelectItem
                    key={size.value}
                    value={size.value}
                    className="text-gray-300 focus:bg-cyan-500/20 focus:text-white"
                  >
                    {size.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description (optional) */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-gray-300">
              Business Description
              <span className="text-gray-500 text-xs ml-2">(optional)</span>
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what your business does..."
              rows={3}
              className="w-full rounded-md bg-[#0a1628]/50 border border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 p-2.5 text-sm resize-none"
            />
          </div>
        </div>

        {/* Navigation */}
        <div className="flex justify-end pt-2">
          <Button
            onClick={handleNext}
            disabled={!isValid}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
