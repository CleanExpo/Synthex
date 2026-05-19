import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { BuyerPersona } from '@/lib/marketing-agency/types';

interface PersonaMapPanelProps {
  personas: BuyerPersona[];
}

export function PersonaMapPanel({ personas }: PersonaMapPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-light leading-none tracking-tight text-white">
          Persona Map
        </h2>
        <CardDescription>Draft audiences generated from verified RestoreAssist source context.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-3">
          {personas.map((persona) => (
            <article key={persona.id} className="rounded-sm border border-white/10 p-4">
              <h3 className="text-sm font-semibold text-white">{persona.name}</h3>
              <p className="mt-2 text-xs text-white/60">{persona.platformPriority}</p>
              <p className="mt-3 text-sm text-white/75">{persona.coreProblem}</p>
              <p className="mt-3 text-sm text-white/85">{persona.messageAngle}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-white/60">CTA</p>
              <p className="mt-1 text-sm text-white/75">{persona.primaryCta}</p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
