'use client';

/**
 * Business Details Review Component
 *
 * @description Shows AI-generated business details with Accept/Edit controls per field.
 * Falls back to standard form if no AI analysis available.
 */

import React, { useState } from 'react';
import { Check, Edit, Sparkles } from '@/components/icons';
// Alias for Pencil icon
const Pencil = Edit;
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

// ============================================================================
// TYPES
// ============================================================================

export interface ReviewedDetails {
  industry: string;
  teamSize: string;
  description: string;
  brandColors: { primary?: string; secondary?: string; accent?: string };
  socialHandles: Record<string, string>;
}

interface BusinessDetailsReviewProps {
  details: ReviewedDetails;
  isAiGenerated: boolean;
  confidence?: number;
  onChange: (details: ReviewedDetails) => void;
}

// ============================================================================
// FIELD WRAPPER — shows AI badge + accept/edit toggle
// ============================================================================

function ReviewField({
  label,
  isAiGenerated,
  isEditing,
  onToggleEdit,
  children,
}: {
  label: string;
  isAiGenerated: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300 flex items-center gap-2">
          {label}
          {isAiGenerated && !isEditing && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
              <Sparkles className="w-3 h-3" />
              AI
            </span>
          )}
        </Label>
        {isAiGenerated && (
          <button
            type="button"
            onClick={onToggleEdit}
            className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-cyan-400 transition-colors"
          >
            {isEditing ? (
              <>
                <Check className="w-3 h-3" />
                Done
              </>
            ) : (
              <>
                <Pencil className="w-3 h-3" />
                Edit
              </>
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BusinessDetailsReview({
  details,
  isAiGenerated,
  confidence,
  onChange,
}: BusinessDetailsReviewProps) {
  const [editingFields, setEditingFields] = useState<Set<string>>(
    isAiGenerated ? new Set() : new Set(['industry', 'teamSize', 'description'])
  );

  const toggleEdit = (field: string) => {
    setEditingFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const updateField = <K extends keyof ReviewedDetails>(
    field: K,
    value: ReviewedDetails[K]
  ) => {
    onChange({ ...details, [field]: value });
  };

  const industryLabel = INDUSTRIES.find((i) => i.value === details.industry)?.label || details.industry;
  const teamSizeLabel = TEAM_SIZES.find((t) => t.value === details.teamSize)?.label || details.teamSize;

  return (
    <div className="space-y-5">
      {/* Confidence indicator */}
      {isAiGenerated && confidence !== undefined && confidence < 50 && (
        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-300">
            Some details may need correction — we analyzed what we could from your website.
          </p>
        </div>
      )}

      {/* Industry */}
      <ReviewField
        label="Industry"
        isAiGenerated={isAiGenerated}
        isEditing={editingFields.has('industry')}
        onToggleEdit={() => toggleEdit('industry')}
      >
        {editingFields.has('industry') || !isAiGenerated ? (
          <Select
            value={details.industry}
            onValueChange={(v) => updateField('industry', v)}
          >
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
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-[#0a1628]/50 border border-cyan-500/10">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-white">{industryLabel}</span>
          </div>
        )}
      </ReviewField>

      {/* Team Size */}
      <ReviewField
        label="Team Size"
        isAiGenerated={isAiGenerated}
        isEditing={editingFields.has('teamSize')}
        onToggleEdit={() => toggleEdit('teamSize')}
      >
        {editingFields.has('teamSize') || !isAiGenerated ? (
          <Select
            value={details.teamSize}
            onValueChange={(v) => updateField('teamSize', v)}
          >
            <SelectTrigger className="bg-[#0a1628]/50 border-cyan-500/20 text-white focus:border-cyan-500/50 focus:ring-cyan-500/20">
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
        ) : (
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-[#0a1628]/50 border border-cyan-500/10">
            <Check className="w-4 h-4 text-emerald-400" />
            <span className="text-white">{teamSizeLabel}</span>
          </div>
        )}
      </ReviewField>

      {/* Description */}
      <ReviewField
        label="Business Description"
        isAiGenerated={isAiGenerated}
        isEditing={editingFields.has('description')}
        onToggleEdit={() => toggleEdit('description')}
      >
        {editingFields.has('description') || !isAiGenerated ? (
          <textarea
            value={details.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="A brief description of your business..."
            rows={3}
            className="w-full rounded-md bg-[#0a1628]/50 border border-cyan-500/20 text-white placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-cyan-500/20 p-2.5 text-sm resize-none"
          />
        ) : (
          <div className="flex items-start gap-2 p-2.5 rounded-md bg-[#0a1628]/50 border border-cyan-500/10">
            <Check className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <span className="text-white text-sm">{details.description || 'No description'}</span>
          </div>
        )}
      </ReviewField>

      {/* Brand Color (primary only for simplicity) */}
      <ReviewField
        label="Brand Color"
        isAiGenerated={isAiGenerated && !!details.brandColors.primary}
        isEditing={editingFields.has('brandColors')}
        onToggleEdit={() => toggleEdit('brandColors')}
      >
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={details.brandColors.primary || '#06b6d4'}
            onChange={(e) =>
              updateField('brandColors', { ...details.brandColors, primary: e.target.value })
            }
            className="w-10 h-10 rounded-lg border border-cyan-500/20 bg-transparent cursor-pointer"
          />
          <span className="text-sm text-gray-400">
            {details.brandColors.primary || '#06b6d4'}
          </span>
        </div>
      </ReviewField>

      {/* Social Handles (if any detected) */}
      {Object.keys(details.socialHandles).length > 0 && (
        <div className="space-y-2">
          <Label className="text-gray-300 flex items-center gap-2">
            Detected Social Accounts
            {isAiGenerated && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">
                <Sparkles className="w-3 h-3" />
                AI
              </span>
            )}
          </Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(details.socialHandles).map(([platform, handle]) => (
              <div
                key={platform}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0a1628]/50 border border-cyan-500/10 text-sm"
              >
                <span className="text-cyan-400 capitalize">{platform}</span>
                <span className="text-gray-400">{handle}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm All button for AI mode */}
      {isAiGenerated && editingFields.size === 0 && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingFields(new Set(['industry', 'teamSize', 'description', 'brandColors']));
            }}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Edit all fields
          </Button>
        </div>
      )}
    </div>
  );
}
