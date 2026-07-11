'use client';

import { CheckCircle2 } from '@/components/icons';
import { SectionFloatingGradients } from './floating-gradients';
import { SectionReveal } from './section-reveal';

const walkthroughSteps = [
  {
    title: 'Upload a transcript',
    copy: 'A founder drops a voice note or meeting summary into intake.',
  },
  {
    title: 'AI extracts strategy',
    copy: 'Research council links sources before any creative is drafted.',
  },
  {
    title: 'Campaign plan generated',
    copy: 'Cards appear: audience, offer, channels, assets and risks.',
  },
  {
    title: 'Copy and creative staged',
    copy: 'Posts, email, thumbnails and video briefs enter review.',
  },
  {
    title: 'Designer reviews',
    copy: 'Comments, version diff and evidence panel — no black box.',
  },
  {
    title: 'Manager approves',
    copy: 'Explicit gate — nothing publishes without a named approver.',
  },
  {
    title: 'Publishing queue',
    copy: 'Scheduled posts with platform icons and conflict detection.',
  },
  {
    title: 'Analytics dashboard',
    copy: 'Performance feeds the next planning cycle with traceable signal.',
  },
];

export function ProductWalkthrough() {
  return (
    <section
      className="relative overflow-hidden border-y border-white/[0.04] bg-sx-bg-panel py-32"
      aria-labelledby="product-walkthrough-heading"
    >
      <SectionFloatingGradients variant="lower" />
      <div
        className="pointer-events-none absolute inset-0 landing-hero-line-grid opacity-20"
        aria-hidden
      />
      <div className="relative mx-auto max-w-content px-5">
        <SectionReveal>
          <div className="mb-14 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              Product walkthrough
            </p>
            <h2
              id="product-walkthrough-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-5xl"
            >
              From rough idea to measured outcome —{' '}
              <span className="landing-gradient-text-intelligence">
                step by step
              </span>
            </h2>
            <p className="mt-5 text-base leading-8 text-sx-text-secondary">
              Marketing workflow automation with editorial discipline: every
              handoff visible, every claim evidence-backed.
            </p>
          </div>
        </SectionReveal>

        <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div role="list" className="space-y-0">
            {walkthroughSteps.map((step, index) => (
              <SectionReveal key={step.title} delay={index * 40}>
                <div
                  role="listitem"
                  className="relative border-l border-white/[0.08] py-5 pl-8 first:pt-0 last:pb-0 [border-image:linear-gradient(180deg,rgba(255,122,24,0.3),rgba(139,92,246,0.2))_1]"
                >
                  <span
                    className="absolute -left-[5px] top-6 flex h-2.5 w-2.5 rounded-full bg-sx-accent shadow-[0_0_12px_rgba(255,122,24,0.35)]"
                    aria-hidden
                  />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sx-text-muted">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-sx-text-primary">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-6 text-sx-text-muted">
                    {step.copy}
                  </p>
                </div>
              </SectionReveal>
            ))}
          </div>

          <SectionReveal delay={120}>
            <div className="sticky top-28 overflow-hidden rounded-card border border-white/[0.1] bg-sx-bg-primary/90 p-3 shadow-[var(--sx-shadow-elevated)] backdrop-blur-md">
              <div className="landing-mock-glow-ring pointer-events-none absolute -inset-px rounded-[20px] bg-gradient-to-br from-sx-accent/20 via-transparent to-sx-intelligence/15 opacity-50" />
              <div className="relative">
                <video
                  className="aspect-video w-full rounded-[14px] bg-black object-cover"
                  poster="/videos/synthex-command-center-demo-poster.webp"
                  muted
                  playsInline
                  controls
                  preload="none"
                  aria-label="Synthex marketing command center product demo"
                >
                  <source
                    src="/videos/synthex-command-center-demo.webm"
                    type="video/webm"
                  />
                  <source
                    src="/videos/synthex-command-center-demo.mp4"
                    type="video/mp4"
                  />
                  Synthex product demo video.
                </video>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {[
                    'Research before creative',
                    'Approval before publishing',
                    'Evidence before claims',
                    'Learning after launch',
                  ].map(item => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-xs text-sx-text-muted"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-sx-success" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </SectionReveal>
        </div>
      </div>
    </section>
  );
}
