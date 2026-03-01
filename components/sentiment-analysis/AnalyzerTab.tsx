'use client';

import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Brain } from '@/components/icons';
import type { EmotionScore } from './types';
import { getSentimentIcon, getSentimentColor } from './helpers';

interface AnalyzerTabProps {
  testText: string;
  setTestText: (v: string) => void;
  testResult: any;
  loading: boolean;
  onAnalyze: () => void;
}

export function AnalyzerTab({
  testText, setTestText, testResult, loading, onAnalyze,
}: AnalyzerTabProps) {
  return (
    <div className="space-y-4">
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Real-time Sentiment Analyzer</CardTitle>
          <CardDescription>Test sentiment analysis on any text</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Enter text to analyze sentiment..."
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            className="bg-white/5 border-white/10 min-h-[100px]"
          />

          <Button
            onClick={onAnalyze}
            disabled={loading}
            className="gradient-primary"
          >
            <Brain className="h-4 w-4 mr-2" />
            Analyze Sentiment
          </Button>

          {testResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-white/5 rounded-lg space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getSentimentIcon(testResult.sentiment)}
                  <span className="font-medium text-white capitalize">
                    {testResult.sentiment} Sentiment
                  </span>
                </div>
                <Badge className={getSentimentColor(testResult.score)}>
                  Score: {(testResult.score * 100).toFixed(0)}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Confidence</span>
                <span className="text-white">{testResult.confidence.toFixed(1)}%</span>
              </div>

              {testResult.emotions.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Detected Emotions</p>
                  <div className="flex gap-2">
                    {testResult.emotions.map((emotion: EmotionScore) => (
                      <Badge key={emotion.emotion} variant="secondary" className="text-xs">
                        {emotion.emotion}: {(emotion.score * 100).toFixed(0)}%
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {testResult.keyPhrases?.length > 0 && (
                <div>
                  <p className="text-sm text-gray-400 mb-2">Key Phrases</p>
                  <div className="flex flex-wrap gap-2">
                    {testResult.keyPhrases.map((phrase: string, i: number) => (
                      <Badge key={i} className="bg-cyan-500/20 text-cyan-400 text-xs">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
