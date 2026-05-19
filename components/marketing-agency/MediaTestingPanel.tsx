import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type {
  MediaTestCheck,
  MediaTestingPlanItem,
} from '@/lib/marketing-agency/media-testing';

interface MediaTestingPanelProps {
  items: MediaTestingPlanItem[];
}

function statusClass(status: MediaTestCheck['status']): string {
  if (status === 'pass') return 'border-emerald-500/30 text-emerald-200';
  if (status === 'warn') return 'border-amber-500/30 text-amber-200';
  return 'border-red-500/30 text-red-200';
}

function CheckList({
  title,
  checks,
}: {
  title: string;
  checks: MediaTestCheck[];
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-white/60">
        {title}
      </h4>
      <ul className="mt-2 grid gap-2">
        {checks.map(check => (
          <li
            key={check.label}
            className={`rounded-sm border px-3 py-2 text-sm ${statusClass(check.status)}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-white">{check.label}</span>
              <span className="text-xs uppercase tracking-wide">{check.status}</span>
            </div>
            <p className="mt-1 text-xs text-white/65">{check.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MediaTestingPanel({ items }: MediaTestingPanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-light leading-none tracking-tight text-white">
          Human Review & AV Testing
        </h2>
        <CardDescription>
          Visual, audio, and approval checks before any generated cut becomes client-ready.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {items.map(item => (
          <section key={item.storyboardId} className="grid gap-4 rounded-sm border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-1 text-xs text-white/60">
                  {item.format} · {item.pixelSize} · {item.durationSec}s
                </p>
              </div>
              <div className="rounded-sm border border-white/10 px-3 py-2 text-right">
                <p className="text-xs uppercase tracking-wide text-white/50">VO pace</p>
                <p className="text-sm font-semibold text-white">
                  {item.estimatedWordsPerMinute} wpm
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <CheckList title="Visual checks" checks={item.visualChecks} />
              <CheckList title="Audio checks" checks={item.audioChecks} />
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-white/60">
                Human approval questions
              </h4>
              <ul className="mt-2 grid gap-2 text-sm text-white/75 md:grid-cols-2">
                {item.humanReviewQuestions.map(question => (
                  <li key={question} className="rounded-sm bg-white/[0.03] px-3 py-2">
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
