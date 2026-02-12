'use client';

/**
 * Persona Details Component
 * Displays selected persona details and actions
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Edit, Trash2, Brain, Copy, Settings, Loader2 } from 'lucide-react';
import type { Persona } from './types';

interface PersonaDetailsProps {
  persona: Persona;
  isTraining: boolean;
  onTrain: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClone: () => void;
  onConfigure: () => void;
}

export function PersonaDetails({
  persona,
  isTraining,
  onTrain,
  onEdit,
  onDelete,
  onClone,
  onConfigure,
}: PersonaDetailsProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{persona.name}</CardTitle>
            <CardDescription className="text-slate-400">
              Last trained: {persona.lastTrained}
            </CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button size="sm" variant="ghost" className="text-slate-400" onClick={onEdit}>
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="space-y-3">
            <div>
              <Label className="text-slate-400">Tone</Label>
              <p className="text-white">{persona.attributes.tone}</p>
            </div>
            <div>
              <Label className="text-slate-400">Style</Label>
              <p className="text-white">{persona.attributes.style}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label className="text-slate-400">Vocabulary</Label>
              <p className="text-white">{persona.attributes.vocabulary}</p>
            </div>
            <div>
              <Label className="text-slate-400">Emotion</Label>
              <p className="text-white">{persona.attributes.emotion}</p>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={onTrain}
            disabled={isTraining}
            className="gradient-primary text-white"
          >
            {isTraining ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Training...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Train Persona
              </>
            )}
          </Button>
          <Button onClick={onClone} variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Copy className="mr-2 h-4 w-4" />
            Clone
          </Button>
          <Button onClick={onConfigure} variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10">
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
