'use client';

/**
 * Competitive panel — RestoreAssist vs Encircle / Xactimate / Restorers Connect.
 *
 * Wave 0 ships the seed feature/positioning grid based on the AEO audit
 * findings and existing Hermes context. Wave 1 will overlay Pi-CEO's deeper
 * positioning analysis on top of this.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const COMPETITORS = [
  {
    name: 'RestoreAssist',
    slug: 'ra' as const,
    category: 'Full CRM + FMMS — IICRC-grounded NIR',
    geography: 'AU + NZ',
    flow: '5-step: Inspection → AI Analysis → Scoping → Estimating → Reporting',
    auCompliance: 'IICRC S500 / S520 / S700 + WHS + AU Building Code inbuilt',
    aiRole: 'Assistant — records + documents, never decides',
    weakness: 'New brand, no installed base yet (T+0 = today)',
    isUs: true,
  },
  {
    name: 'Encircle',
    slug: 'encircle' as const,
    category: 'Field-tech-first inspection app',
    geography: 'Global (US-led)',
    flow: 'Single-step: capture → upload',
    auCompliance: 'No AU compliance frameworks',
    aiRole: 'Photo categorisation only',
    weakness: 'No estimating, no scoping, no NIR. Forces Xactimate handoff downstream.',
    isUs: false,
  },
  {
    name: 'Xactimate',
    slug: 'xactimate' as const,
    category: 'Estimating-only',
    geography: 'Global (US-led)',
    flow: 'One step: estimate from line items',
    auCompliance: 'US-led pricing schemas; AU rates approximated',
    aiRole: 'None disclosed',
    weakness: 'Price-list product. Not a workflow. Re-keying from inspection app required.',
    isUs: false,
  },
  {
    name: 'Restorers Connect',
    slug: 'restorers-connect' as const,
    category: 'Scheduling / job board',
    geography: 'AU',
    flow: 'Two-step: assign → schedule',
    auCompliance: 'AU-aware but no compliance framework',
    aiRole: 'None',
    weakness: 'Coordination layer only. No inspection, no estimating, no report.',
    isUs: false,
  },
];

const ROW_DEFS: Array<{ key: keyof (typeof COMPETITORS)[number]; label: string }> = [
  { key: 'category', label: 'Category claim' },
  { key: 'geography', label: 'Geography' },
  { key: 'flow', label: 'Workflow' },
  { key: 'auCompliance', label: 'AU compliance' },
  { key: 'aiRole', label: 'AI role' },
  { key: 'weakness', label: 'Weakness vs RestoreAssist' },
];

export function CompetitivePanel() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Competitive frame</CardTitle>
          <Badge variant="outline" className="font-mono text-[10px]">
            Wave 1 will deepen this
          </Badge>
        </div>
        <CardDescription>
          Seed grid from the AEO audit. RestoreAssist is the only AU-designed full CRM in the
          category — every competitor solves one slice of the 5-step flow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="p-2 text-left font-medium text-muted-foreground"> </th>
                {COMPETITORS.map(c => (
                  <th
                    key={c.slug}
                    className={
                      'p-2 text-left font-semibold ' +
                      (c.isUs ? 'text-foreground' : 'text-muted-foreground')
                    }
                  >
                    {c.name}
                    {c.isUs && (
                      <Badge variant="default" className="ml-2 text-[9px]">
                        us
                      </Badge>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROW_DEFS.map(row => (
                <tr key={row.key} className="border-b border-border/50">
                  <td className="p-2 align-top text-[10px] uppercase tracking-wider text-muted-foreground">
                    {row.label}
                  </td>
                  {COMPETITORS.map(c => (
                    <td
                      key={c.slug}
                      className={
                        'p-2 align-top ' + (c.isUs ? 'font-medium text-foreground' : 'text-muted-foreground')
                      }
                    >
                      {c[row.key] as string}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
