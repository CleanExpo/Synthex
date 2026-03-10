'use client';

/**
 * Persona List Component
 * List of personas with selection
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2, AlertCircle } from '@/components/icons';
import type { Persona } from './types';

interface PersonaListProps {
  personas: Persona[];
  selectedId: number | null;
  onSelect: (persona: Persona) => void;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'training':
      return <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />;
    default:
      return <AlertCircle className="h-4 w-4 text-slate-500" />;
  }
}

export function PersonaList({ personas, selectedId, onSelect }: PersonaListProps) {
  return (
    <Card variant="glass">
      <CardHeader>
        <CardTitle>Your Personas</CardTitle>
        <CardDescription className="text-slate-400">
          Select a persona to view or train
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {personas.map((persona) => (
          <div
            key={persona.id}
            onClick={() => onSelect(persona)}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedId === persona.id
                ? 'bg-cyan-500/20 border-cyan-500'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-semibold text-white">{persona.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{persona.description}</p>
              </div>
              <div className="flex items-center space-x-1">
                {getStatusIcon(persona.status)}
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Accuracy: {persona.accuracy}%</span>
              <span className="text-slate-500">{persona.trainingData.samples} samples</span>
            </div>
            <div className="mt-2">
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-teal-500"
                  style={{ width: `${persona.accuracy}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
