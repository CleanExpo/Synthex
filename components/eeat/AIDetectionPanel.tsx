'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Check, Brain } from '@/components/icons';

interface FlaggedPhrase {
  phrase: string;
  category: string;
  suggestion: string;
}

interface AIDetectionPanelProps {
  aiScore: number;
  cleanScore: number;
  flaggedPhrases: FlaggedPhrase[];
}

const categoryLabels: Record<string, string> = {
  opening_cliche: 'Opening Cliché',
  hedging: 'Hedging',
  filler: 'Filler',
  pomposity: 'AI Pomposity',
  false_intimacy: 'False Intimacy',
};

export function AIDetectionPanel({ aiScore, cleanScore, flaggedPhrases }: AIDetectionPanelProps) {
  return (
    <Card className="bg-white/[0.02] border-white/[0.08]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-400" />
            AI Content Detection
          </CardTitle>
          <Badge className={aiScore > 50 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}>
            {aiScore > 50 ? `${aiScore}% AI-like` : `${cleanScore}% Human-like`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {flaggedPhrases.length === 0 ? (
          <div className="flex items-center gap-2 text-emerald-400 py-4">
            <Check className="h-5 w-5" />
            <span className="text-sm">No AI-generated content patterns detected</span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 mb-3">{flaggedPhrases.length} AI pattern{flaggedPhrases.length > 1 ? 's' : ''} flagged:</p>
            {flaggedPhrases.map((fp, i) => (
              <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-red-300 font-mono">"{fp.phrase}"</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-white/5 text-gray-400 text-xs">{categoryLabels[fp.category] || fp.category}</Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Fix: {fp.suggestion}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
