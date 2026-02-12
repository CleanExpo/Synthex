'use client';

/**
 * Generation Settings Component
 * Content generation configuration form
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Wand2, Loader2, Hash, Smile } from '@/components/icons';
import { platformIcons, hookTypes, toneOptions, lengthOptions, defaultPersonas } from './content-config';

interface GenerationSettingsProps {
  platform: string;
  onPlatformChange: (platform: string) => void;
  topic: string;
  onTopicChange: (topic: string) => void;
  hookType: string;
  onHookTypeChange: (hookType: string) => void;
  tone: string;
  onToneChange: (tone: string) => void;
  personaId: string;
  onPersonaChange: (personaId: string) => void;
  targetLength: string;
  onTargetLengthChange: (length: string) => void;
  includeHashtags: boolean;
  onIncludeHashtagsChange: (include: boolean) => void;
  includeEmojis: boolean;
  onIncludeEmojisChange: (include: boolean) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

export function GenerationSettings({
  platform,
  onPlatformChange,
  topic,
  onTopicChange,
  hookType,
  onHookTypeChange,
  tone,
  onToneChange,
  personaId,
  onPersonaChange,
  targetLength,
  onTargetLengthChange,
  includeHashtags,
  onIncludeHashtagsChange,
  includeEmojis,
  onIncludeEmojisChange,
  isGenerating,
  onGenerate,
}: GenerationSettingsProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Generation Settings</CardTitle>
        <CardDescription className="text-gray-400">
          Configure your content parameters
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Platform Selection */}
        <div>
          <Label className="text-gray-400">Platform</Label>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {Object.entries(platformIcons).map(([key, Icon]) => (
              <button
                key={key}
                onClick={() => onPlatformChange(key)}
                className={`p-3 rounded-lg border transition-all ${
                  platform === key
                    ? 'bg-cyan-500/20 border-cyan-500'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <Icon className="h-5 w-5 mx-auto" />
                <p className="text-xs mt-1 capitalize">{key}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Topic Input */}
        <div>
          <Label htmlFor="topic" className="text-gray-400">Topic</Label>
          <Input
            id="topic"
            placeholder="What do you want to create content about?"
            value={topic}
            onChange={(e) => onTopicChange(e.target.value)}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 mt-2"
          />
        </div>

        {/* Hook Type */}
        <div>
          <Label className="text-gray-400">Hook Type</Label>
          <Select value={hookType} onValueChange={onHookTypeChange}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hookTypes.map((hook) => (
                <SelectItem key={hook.value} value={hook.value}>
                  <div>
                    <div className="font-medium">{hook.label}</div>
                    <div className="text-xs text-gray-400">{hook.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tone */}
        <div>
          <Label className="text-gray-400">Tone</Label>
          <Select value={tone} onValueChange={onToneChange}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white mt-2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {toneOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Persona */}
        <div>
          <Label className="text-gray-400">Persona (Optional)</Label>
          <Select value={personaId} onValueChange={onPersonaChange}>
            <SelectTrigger className="bg-white/5 border-white/10 text-white mt-2">
              <SelectValue placeholder="Select a persona" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {defaultPersonas.map((persona) => (
                <SelectItem key={persona.id} value={persona.id}>
                  {persona.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Length */}
        <div>
          <Label className="text-gray-400">Content Length</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {lengthOptions.map((length) => (
              <button
                key={length}
                onClick={() => onTargetLengthChange(length)}
                className={`py-2 px-4 rounded-lg border capitalize transition-all ${
                  targetLength === length
                    ? 'bg-cyan-500/20 border-cyan-500'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                {length}
              </button>
            ))}
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeHashtags}
              onChange={(e) => onIncludeHashtagsChange(e.target.checked)}
              className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
            />
            <Hash className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-white">Include Hashtags</span>
          </label>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeEmojis}
              onChange={(e) => onIncludeEmojisChange(e.target.checked)}
              className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500"
            />
            <Smile className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-white">Include Emojis</span>
          </label>
        </div>

        {/* Generate Button */}
        <Button
          onClick={onGenerate}
          disabled={isGenerating || !topic}
          className="w-full gradient-primary text-white"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Generate Content
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
