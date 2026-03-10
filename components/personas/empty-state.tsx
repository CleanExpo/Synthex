'use client';

/**
 * Persona Empty State Component
 * Displayed when no persona is selected
 */

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Brain, Plus } from '@/components/icons';

interface PersonaEmptyStateProps {
  onCreateClick: () => void;
}

export function PersonaEmptyState({ onCreateClick }: PersonaEmptyStateProps) {
  return (
    <Card variant="glass">
      <CardContent className="pt-20 pb-20 text-center">
        <Brain className="h-16 w-16 mx-auto mb-4 text-slate-500" />
        <h3 className="text-xl font-semibold text-white mb-2">Select a Persona</h3>
        <p className="text-slate-400 mb-6">
          Choose a persona from the list to view details and add training data
        </p>
        <Button onClick={onCreateClick} className="gradient-primary text-white">
          <Plus className="mr-2 h-4 w-4" />
          Create Your First Persona
        </Button>
      </CardContent>
    </Card>
  );
}
