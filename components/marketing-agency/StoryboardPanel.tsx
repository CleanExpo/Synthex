import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { CampaignStoryboard } from '@/lib/marketing-agency/types';

interface StoryboardPanelProps {
  storyboards: CampaignStoryboard[];
}

export function StoryboardPanel({ storyboards }: StoryboardPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-light leading-none tracking-tight text-white">
          Storyboards
        </h2>
        <CardDescription>Scene plans ready for video production and Remotion data mapping.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {storyboards.map((storyboard) => (
          <section key={storyboard.id} className="rounded-sm border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">{storyboard.title}</h3>
              <p className="text-xs text-white/60">
                {storyboard.channel} · {storyboard.primaryFormat} · {storyboard.durationSec}s
              </p>
            </div>
            <dl className="mt-3 grid gap-2 text-xs text-white/70 md:grid-cols-2">
              <div>
                <dt className="font-semibold text-white">Persona</dt>
                <dd>{storyboard.targetPersona}</dd>
              </div>
              <div>
                <dt className="font-semibold text-white">CTA</dt>
                <dd>{storyboard.callToAction}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-semibold text-white">Client-first strategy</dt>
                <dd>{storyboard.strategy}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-semibold text-white">Audio direction</dt>
                <dd>{storyboard.audioDirection}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-semibold text-white">Ranking rationale</dt>
                <dd>
                  <ul className="mt-1 grid gap-1">
                    {storyboard.rankingRationale.map(reason => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="font-semibold text-white">Test hypothesis</dt>
                <dd>{storyboard.testHypothesis}</dd>
              </div>
            </dl>
            <div className="mt-4 grid gap-3">
              {storyboard.scenes.map((scene) => (
                <article key={scene.index} className="grid gap-2 rounded-sm bg-white/[0.03] p-3 md:grid-cols-[120px_1fr]">
                  <div className="text-xs text-white/60">
                    {scene.startSec}-{scene.endSec}s
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{scene.onScreenText}</p>
                    <p className="mt-1 text-sm text-white/70">{scene.voiceover}</p>
                    <p className="mt-2 text-xs text-white/60">{scene.visualNote}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
