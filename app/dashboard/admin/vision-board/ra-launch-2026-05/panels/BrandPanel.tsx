'use client';

/**
 * Brand panel — live data from packages/brand-config/src/brands/ra.ts.
 *
 * No hardcoded brand values. If the BrandConfig changes, this panel reflects
 * the change immediately. Renders RA tokens (#E55A2B candy orange, #2A3D45
 * slate, #C5E063 lime, Inter + JetBrains Mono) — never Synthex tokens.
 */

import { ra } from '@unite-group/brand-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function ColourSwatch({ name, role, hex }: { name: string; role: string; hex: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div
        className="h-20 w-full rounded-lg border border-white/10 shadow-sm"
        style={{ backgroundColor: hex }}
        aria-label={`${name} swatch`}
      />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-foreground">{name}</span>
        <span className="font-mono text-xs text-muted-foreground">{hex}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{role}</span>
      </div>
    </div>
  );
}

export function BrandPanel() {
  const c = ra.colour;
  const dark = c.darkVariant;

  return (
    <Card className="flex flex-col gap-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Brand — {ra.displayName}</CardTitle>
            <CardDescription>
              Live from <code className="font-mono">@unite-group/brand-config</code> · slug{' '}
              <code className="font-mono">{ra.slug}</code> · tagline “{ra.tagline}”
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            ra.ts · 2026-05-05
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-8">
        {/* Colour — light variant */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Colour · light</h3>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            <ColourSwatch name="Primary" role="brand mark" hex={c.primary} />
            <ColourSwatch name="Secondary" role="slate" hex={c.secondary} />
            <ColourSwatch name="Accent" role="NIR / CTA" hex={c.accent} />
            <ColourSwatch name="Success" role="semantic" hex={c.semantic.success} />
            <ColourSwatch name="Warning" role="semantic" hex={c.semantic.warning} />
            <ColourSwatch name="Danger" role="semantic" hex={c.semantic.danger} />
          </div>
        </section>

        {/* Colour — dark variant */}
        {dark && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Colour · dark</h3>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
              {dark.primary && <ColourSwatch name="Primary (dark)" role="brand mark" hex={dark.primary} />}
              {dark.secondary && <ColourSwatch name="Secondary (dark)" role="slate" hex={dark.secondary} />}
              {dark.neutral?.[900] && <ColourSwatch name="Neutral 900" role="surface" hex={dark.neutral[900]} />}
              {dark.neutral?.[500] && <ColourSwatch name="Neutral 500" role="text muted" hex={dark.neutral[500]} />}
              {dark.neutral?.[100] && <ColourSwatch name="Neutral 100" role="surface alt" hex={dark.neutral[100]} />}
              {dark.neutral?.[50] && <ColourSwatch name="Neutral 50" role="text high" hex={dark.neutral[50]} />}
            </div>
          </section>
        )}

        {/* Typography */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Typography</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Display</p>
              <p
                className="mt-2 text-3xl"
                style={{ fontFamily: ra.typography.display.family, fontWeight: ra.typography.display.weight }}
              >
                One System.
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {ra.typography.display.family} · {ra.typography.display.weight}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Body</p>
              <p
                className="mt-2 text-base"
                style={{ fontFamily: ra.typography.body.family, fontWeight: ra.typography.body.weight }}
              >
                Field tech captures it once. The system does the rest.
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">
                {ra.typography.body.family} · {ra.typography.body.weight}
              </p>
            </div>
            {ra.typography.mono && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Mono</p>
                <p
                  className="mt-2 text-sm"
                  style={{ fontFamily: ra.typography.mono.family, fontWeight: ra.typography.mono.weight }}
                >
                  NIR-2026-05-08-AU-001
                </p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  {ra.typography.mono.family} · {ra.typography.mono.weight}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Voice */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Voice</h3>
          <div className="flex flex-wrap gap-2">
            {ra.voice.tone.map(t => (
              <Badge key={t} variant="secondary" className="capitalize">
                {t}
              </Badge>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Forbidden words ({ra.voice.forbiddenWords.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ra.voice.forbiddenWords.map(w => (
                <span
                  key={w}
                  className="rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-mono text-[11px] text-destructive"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Cadence</p>
            <p className="mt-1 text-sm">{ra.voice.requiredCadence ?? 'unspecified'}</p>
          </div>
        </section>

        {/* doNot */}
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">Do not</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {ra.doNot.map((rule, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-destructive">×</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Audience + voiceover + motion summary */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Audience</p>
            <p className="mt-1 text-sm">{ra.audience.primary}</p>
            {ra.audience.secondary && (
              <p className="mt-1 text-xs text-muted-foreground">also: {ra.audience.secondary}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Voiceover</p>
            <p className="mt-1 text-sm">
              ElevenLabs · <span className="font-mono text-xs">{ra.voiceover.elevenLabsVoiceId}</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {ra.voiceover.style} · {ra.voiceover.locale}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Motion signature</p>
            <p className="mt-1 text-sm capitalize">{ra.motion.signature}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              base {ra.motion.durations.base}f · transition {ra.motion.transitionFrames}f @ 30fps
            </p>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
