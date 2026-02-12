'use client';

/**
 * Onboarding Step 1: Organization Setup
 *
 * @description Collects organization details with Synthex branding
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Building } from '@/components/icons';
// Alias for Building2
const Building2 = Building;
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
import { useOnboarding, ProgressIndicator } from '@/components/onboarding';

// ============================================================================
// DATA
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
  { value: 'other', label: 'Other' },
];

const TEAM_SIZES = [
  { value: 'solo', label: 'Just me' },
  { value: 'small', label: '2-10 people' },
  { value: 'medium', label: '11-50 people' },
  { value: 'large', label: '51-200 people' },
  { value: 'enterprise', label: '200+ people' },
];

const STEPS = [
  { id: 1, name: 'Organization' },
  { id: 2, name: 'Platforms' },
  { id: 3, name: 'Persona' },
  { id: 4, name: 'Complete' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function Step1Page() {
  const router = useRouter();
  const { data, setOrganization, completeStep } = useOnboarding();

  const [name, setName] = useState(data.organizationName);
  const [industry, setIndustry] = useState(data.industry);
  const [teamSize, setTeamSize] = useState(data.teamSize);

  const handleNext = () => {
    setOrganization(name, industry, teamSize);
    completeStep(1);
    router.push('/onboarding/step-2');
  };

  const isValid = name.trim().length > 0 && industry && teamSize;

  return (
    <div className="space-y-8">
      {/* Progress */}
      <ProgressIndicator
        steps={STEPS}
        currentStep={1}
        completedSteps={data.completedSteps}
      />

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <Building2 className="w-7 h-7 text-cyan-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Tell us about your organization</h1>
        <p className="text-gray-400">
          This helps us personalize your experience
        </p>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto space-y-6">
        {/* Form Card */}
        <div className="p-6 rounded-xl bg-[#0f172a]/80 border border-cyan-500/10 backdrop-blur-sm space-y-6">
          {/* Organization Name */}
          <div className="space-y-2">
            <Label htmlFor="org-name" className="text-gray-300">
              Organization or Brand Name
            </Label>
            <Input
              id="org-name"
              placeholder="Enter your organization name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[#0a1628]/50 border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20"
            />
          </div>

          {/* Industry */}
          <div className="space-y-2">
            <Label htmlFor="industry" className="text-gray-300">
              Industry
            </Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger
                id="industry"
                className="bg-[#0a1628]/50 border-cyan-500/20 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20"
              >
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
            <Label htmlFor="team-size" className="text-gray-300">
              Team Size
            </Label>
            <Select value={teamSize} onValueChange={setTeamSize}>
              <SelectTrigger
                id="team-size"
                className="bg-[#0a1628]/50 border-cyan-500/20 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20"
              >
                <SelectValue placeholder="Select team size" />
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
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-md mx-auto pt-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding')}
          className="text-gray-400 hover:text-white hover:bg-cyan-500/10"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
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
  );
}
