'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Check, Eye } from '@/components/icons';

interface CitablePassage {
  text: string;
  wordCount: number;
  score: number;
  isOptimalLength: boolean;
  answerFirst: boolean;
  hasCitation: boolean;
}

interface PassageHighlighterProps {
  passages: CitablePassage[];
}

export function PassageHighlighter({ passages }: PassageHighlighterProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!passages?.length) return null;

  return (
    <Card className="bg-white/[0.02] border-white/[0.08]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-lg flex items-center gap-2">
            <Eye className="h-5 w-5 text-cyan-400" />
            Citable Passages
          </CardTitle>
          <span className="text-sm text-gray-400">
            {passages.filter(p => p.isOptimalLength).length}/{passages.length} optimal
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {passages.slice(0, 10).map((passage, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/[0.05] bg-white/[0.01] overflow-hidden cursor-pointer"
              onClick={() => setExpanded(expanded === i ? null : i)}
            >
              <div className="flex items-center gap-3 p-3">
                {expanded === i ? (
                  <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">
                    {passage.text.substring(0, 100)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`text-xs ${passage.isOptimalLength ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {passage.wordCount}w
                  </Badge>
                  <span className={`text-sm font-medium ${passage.score >= 70 ? 'text-emerald-400' : passage.score >= 50 ? 'text-amber-400' : 'text-red-400'}`}>
                    {passage.score}
                  </span>
                </div>
              </div>
              {expanded === i && (
                <div className="px-3 pb-3 border-t border-white/[0.05]">
                  <p className="text-sm text-gray-300 mt-3 leading-relaxed">{passage.text}</p>
                  <div className="flex gap-2 mt-2">
                    {passage.answerFirst && <Badge className="bg-cyan-500/20 text-cyan-400 text-xs">Answer-First</Badge>}
                    {passage.hasCitation && <Badge className="bg-purple-500/20 text-purple-400 text-xs">Has Citation</Badge>}
                    {passage.isOptimalLength && <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">Optimal Length</Badge>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
