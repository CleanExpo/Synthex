'use client';

/**
 * Persona Setup
 *
 * @description Component for creating a brand persona during onboarding
 */

import React, { useState } from 'react';
import { Sparkles, Check } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnboarding } from './OnboardingContext';

// ============================================================================
// TYPES
// ============================================================================

interface ToneOption {
  id: string;
  name: string;
  description: string;
  emoji: string;
}

interface TopicOption {
  id: string;
  name: string;
}

// ============================================================================
// OPTIONS DATA
// ============================================================================

const TONE_OPTIONS: ToneOption[] = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Formal, authoritative, expert',
    emoji: '👔',
  },
  {
    id: 'friendly',
    name: 'Friendly',
    description: 'Warm, approachable, conversational',
    emoji: '😊',
  },
  {
    id: 'witty',
    name: 'Witty',
    description: 'Clever, humorous, engaging',
    emoji: '😄',
  },
  {
    id: 'inspiring',
    name: 'Inspiring',
    description: 'Motivational, uplifting, passionate',
    emoji: '✨',
  },
  {
    id: 'educational',
    name: 'Educational',
    description: 'Informative, clear, helpful',
    emoji: '📚',
  },
  {
    id: 'bold',
    name: 'Bold',
    description: 'Confident, direct, impactful',
    emoji: '🔥',
  },
];

const TOPIC_OPTIONS: TopicOption[] = [
  { id: 'technology', name: 'Technology' },
  { id: 'business', name: 'Business' },
  { id: 'marketing', name: 'Marketing' },
  { id: 'lifestyle', name: 'Lifestyle' },
  { id: 'health', name: 'Health & Wellness' },
  { id: 'finance', name: 'Finance' },
  { id: 'education', name: 'Education' },
  { id: 'entertainment', name: 'Entertainment' },
  { id: 'travel', name: 'Travel' },
  { id: 'food', name: 'Food & Dining' },
  { id: 'fashion', name: 'Fashion' },
  { id: 'sports', name: 'Sports' },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function PersonaSetup() {
  const { data, setPersona, skipPersona } = useOnboarding();
  const [name, setName] = useState(data.personaName);
  const [selectedTone, setSelectedTone] = useState(data.personaTone);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(data.personaTopics);

  const handleToneSelect = (toneId: string) => {
    setSelectedTone(toneId);
    updatePersona(name, toneId, selectedTopics);
  };

  const handleTopicToggle = (topicId: string) => {
    const newTopics = selectedTopics.includes(topicId)
      ? selectedTopics.filter((t) => t !== topicId)
      : [...selectedTopics, topicId].slice(0, 5); // Max 5 topics

    setSelectedTopics(newTopics);
    updatePersona(name, selectedTone, newTopics);
  };

  const handleNameChange = (newName: string) => {
    setName(newName);
    updatePersona(newName, selectedTone, selectedTopics);
  };

  const updatePersona = (n: string, tone: string, topics: string[]) => {
    if (n && tone) {
      setPersona(n, tone, topics);
    }
  };

  const isValid = name.trim().length > 0 && selectedTone;

  return (
    <div className="space-y-8">
      {/* Persona Name */}
      <div className="space-y-2">
        <Label htmlFor="persona-name" className="text-base font-medium">
          Persona Name
        </Label>
        <p className="text-sm text-muted-foreground">
          Give your brand voice a name (e.g., &quot;Alex from TechCorp&quot;)
        </p>
        <Input
          id="persona-name"
          placeholder="Enter persona name..."
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Tone Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Voice Tone</Label>
        <p className="text-sm text-muted-foreground">
          Select the tone that best represents your brand
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TONE_OPTIONS.map((tone) => {
            const isSelected = selectedTone === tone.id;

            return (
              <button
                key={tone.id}
                type="button"
                onClick={() => handleToneSelect(tone.id)}
                className={cn(
                  'relative p-4 border rounded-lg text-left transition-all duration-200',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border hover:border-primary/50'
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  </div>
                )}
                <span className="text-2xl mb-2 block">{tone.emoji}</span>
                <h4 className="font-medium text-foreground">{tone.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{tone.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Topic Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">Content Topics</Label>
        <p className="text-sm text-muted-foreground">
          Select up to 5 topics your content focuses on (optional)
        </p>
        <div className="flex flex-wrap gap-2">
          {TOPIC_OPTIONS.map((topic) => {
            const isSelected = selectedTopics.includes(topic.id);
            const isDisabled = !isSelected && selectedTopics.length >= 5;

            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => handleTopicToggle(topic.id)}
                disabled={isDisabled}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-full border transition-all duration-200',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:border-primary/50',
                  isDisabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {topic.name}
              </button>
            );
          })}
        </div>
        {selectedTopics.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {selectedTopics.length}/5 topics selected
          </p>
        )}
      </div>

      {/* AI Preview */}
      {isValid && (
        <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">{name}</h4>
              <p className="text-sm text-muted-foreground mt-1">
                A {TONE_OPTIONS.find((t) => t.id === selectedTone)?.name.toLowerCase()} voice
                {selectedTopics.length > 0 && (
                  <>
                    {' '}focused on{' '}
                    {selectedTopics
                      .slice(0, 3)
                      .map((t) => TOPIC_OPTIONS.find((o) => o.id === t)?.name.toLowerCase())
                      .join(', ')}
                    {selectedTopics.length > 3 && ` and ${selectedTopics.length - 3} more`}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Skip option */}
      <div className="pt-4 border-t">
        <Button
          variant="ghost"
          onClick={skipPersona}
          className="text-muted-foreground hover:text-foreground"
        >
          Skip for now — I&apos;ll set this up later
        </Button>
      </div>
    </div>
  );
}

export default PersonaSetup;
