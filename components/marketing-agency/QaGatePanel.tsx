import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { CampaignQaResult } from '@/lib/marketing-agency/qa';
import type { GateResult } from '@/lib/marketing-agency/types';

interface QaGatePanelProps {
  qa: CampaignQaResult;
}

const GATES: Array<{ key: keyof CampaignQaResult; label: string }> = [
  { key: 'claimGate', label: 'Claims' },
  { key: 'licenceGate', label: 'Licences' },
  { key: 'consentGate', label: 'Consent' },
  { key: 'formatGate', label: 'Formats' },
  { key: 'publishGate', label: 'Publishing' },
];

export function QaGatePanel({ qa }: QaGatePanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-light leading-none tracking-tight text-white">
            QA Gates
          </h2>
          <Badge variant={qa.exportReady ? 'default' : 'destructive'}>
            {qa.exportReady ? 'export ready' : 'blocked'}
          </Badge>
        </div>
        <CardDescription>Client-ready export is blocked until every required gate passes.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {GATES.map(({ key, label }) => {
          const gate = qa[key] as GateResult;

          return (
            <section key={key} className="rounded-sm border border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-white">{label}</h3>
                <Badge variant={gate.status === 'blocked' ? 'destructive' : 'outline'}>{gate.status}</Badge>
              </div>
              {gate.blockedReasons.length > 0 && (
                <ul className="mt-3 grid gap-2 text-sm text-white/70">
                  {gate.blockedReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}
