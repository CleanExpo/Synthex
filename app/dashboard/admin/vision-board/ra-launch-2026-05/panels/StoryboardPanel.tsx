'use client';

/**
 * Storyboard panel — 5 scenes from SYN-921.
 *
 * Wave 0 ships the scene cards with brand-voice-enforce score per scene.
 * Wave 4 swaps in the Remotion Player embed once the RA-Launch-NIR
 * composition is registered in the cross-repo Remotion studio.
 */

import { ra } from '@unite-group/brand-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NIR_STORYBOARD } from '@/lib/vision-board/nir-storyboard';
import { voiceEnforce } from '@/lib/vision-board/voice-enforce';

function VoiceScoreChip({ text }: { text: string }) {
  const score = voiceEnforce(text);
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ' +
          (score.passed
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')
        }
      >
        {score.passed ? '✓ voice-pass' : '⚠ review'} · grade {score.readingLevelGrade}
      </span>
      {!score.passed && score.notes.length > 0 && (
        <span className="font-mono text-[10px] text-muted-foreground">{score.notes[0]}</span>
      )}
    </div>
  );
}

export function StoryboardPanel() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Storyboard — NIR explainer (90s LinkedIn)</CardTitle>
            <CardDescription>
              5 scenes × 18s · sweep transitions · ElevenLabs Sarah · Wave 4 will render this.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            {NIR_STORYBOARD.aspectRatio} · {NIR_STORYBOARD.totalDurationSec}s
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {NIR_STORYBOARD.scenes.map(scene => (
            <article
              key={scene.index}
              className="overflow-hidden rounded-lg border border-border"
            >
              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr]">
                {/* Scene timing block — uses RA brand colour, not Synthex */}
                <div
                  className="flex flex-col items-center justify-center gap-1 p-4"
                  style={{ backgroundColor: ra.colour.secondary, color: '#F5F7F8' }}
                >
                  <p
                    className="text-3xl font-bold"
                    style={{ color: ra.colour.primary, fontFamily: ra.typography.display.family }}
                  >
                    {String(scene.index).padStart(2, '0')}
                  </p>
                  <p className="font-mono text-[11px] opacity-80">
                    {scene.startSec}s — {scene.endSec}s
                  </p>
                  <p className="font-mono text-[11px] opacity-80">{scene.durationSec}s</p>
                </div>

                <div className="flex flex-col gap-3 p-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      On-screen text
                    </p>
                    <p
                      className="mt-1 whitespace-pre-line text-sm font-semibold"
                      style={{ fontFamily: ra.typography.display.family }}
                    >
                      {scene.onScreenText}
                    </p>
                    <div className="mt-1.5">
                      <VoiceScoreChip text={scene.onScreenText} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Voiceover (Sarah · en-AU)
                    </p>
                    <p className="mt-1 text-sm italic text-muted-foreground">"{scene.voiceover}"</p>
                    <div className="mt-1.5">
                      <VoiceScoreChip text={scene.voiceover} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">
                      Visual note
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{scene.visualNote}</p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
