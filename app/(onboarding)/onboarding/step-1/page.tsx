'use client';

/**
 * Onboarding Step 1: Organization Setup
 *
 * @description Collects organization details
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Building2 } from 'lucide-react';
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
  const { data, setOrganization, completeStep, canProceed } = useOnboarding();

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
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold">Tell us about your organization</h1>
        <p className="text-muted-foreground">
          This helps us personalize your experience
        </p>
      </div>

      {/* Form */}
      <div className="max-w-md mx-auto space-y-6">
        {/* Organization Name */}
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization or Brand Name</Label>
          <Input
            id="org-name"
            placeholder="Enter your organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Industry */}
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Select value={industry} onValueChange={setIndustry}>
            <SelectTrigger id="industry">
              <SelectValue placeholder="Select your industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  {ind.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Team Size */}
        <div className="space-y-2">
          <Label htmlFor="team-size">Team Size</Label>
          <Select value={teamSize} onValueChange={setTeamSize}>
            <SelectTrigger id="team-size">
              <SelectValue placeholder="Select team size" />
            </SelectTrigger>
            <SelectContent>
              {TEAM_SIZES.map((size) => (
                <SelectItem key={size.value} value={size.value}>
                  {size.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between max-w-md mx-auto pt-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/onboarding')}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleNext} disabled={!isValid}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
