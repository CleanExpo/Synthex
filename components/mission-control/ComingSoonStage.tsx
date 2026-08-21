'use client';

import { COMING_SOON_STAGES } from '@/lib/mission-control/types';
import type { MissionCreatedTicket } from '@/lib/mission-control/types';
import { Lock } from '@/components/icons';

export function ComingSoonStage({
  tickets,
}: {
  tickets: MissionCreatedTicket[];
}) {
  return (
    <div className="border-[0.5px] border-dashed border-white/10 bg-white/1 rounded-sm p-5 sm:p-6 space-y-5">
      <div>
        <p className="text-[9px] uppercase tracking-[0.22em] text-white/30 mb-1">
          Scene 2
        </p>
        <h3 className="text-lg font-light text-white flex items-center gap-2">
          <Lock className="h-4 w-4 text-white/35" />
          Coming soon — execution pipeline
        </h3>
        <p className="text-sm text-white/40 mt-1 max-w-xl leading-relaxed">
          Tickets are live in Linear. Code generation, tests, PRs, deploy
          status, and role-based views ship next — intentionally locked so
          nothing fakes progress.
        </p>
      </div>

      {tickets.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/30">
            Created tickets
          </p>
          <ul className="space-y-1.5">
            {tickets.map(t => (
              <li key={t.linearId}>
                <a
                  href={t.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#FF6B35]/90 hover:text-[#FF6B35] underline-offset-2 hover:underline"
                >
                  {t.identifier}
                </a>
                <span className="text-sm text-white/45"> — {t.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {COMING_SOON_STAGES.map(s => (
          <div
            key={s.key}
            className="border-[0.5px] border-white/6 px-3 py-3 rounded-sm opacity-70"
            aria-disabled
          >
            <p className="text-[9px] uppercase tracking-[0.2em] text-white/25 mb-1">
              Locked
            </p>
            <p className="text-sm text-white/55 font-light">{s.label}</p>
            <p className="text-[11px] text-white/30 mt-1">{s.blurb}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
