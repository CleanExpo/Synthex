import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  HeroCommandVisual,
  LandingVideoShowcase,
  SafetyStrip,
  SimpleMarketingModel,
  SiteShell,
} from '@/components/landing/public-v2';

export const metadata: Metadata = {
  title: 'Synthex | Marketing Command Center',
  description:
    'Synthex is an evidence-backed marketing command center for research, campaign planning, Gen Media production and approval-gated execution.',
};

export default function SynthexHomePage() {
  return (
    <SiteShell>
      <section className="relative overflow-hidden bg-[#08090b] pt-28">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="relative mx-auto grid max-w-7xl gap-9 px-5 pb-12 pt-10 lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[0.88fr_1.12fr] lg:items-center lg:gap-12 lg:pt-14">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 border border-orange-300/25 bg-orange-300/[0.08] px-3 py-2 text-xs uppercase tracking-[0.22em] text-orange-200">
              Controlled pilot · public launch preparing
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl md:text-7xl">
              Give Synthex the idea. Get a clear campaign plan back.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-white/62 md:text-lg md:leading-8">
              Synthex turns a voice note, meeting transcript or product idea
              into simple cards: the plan, the assets, the risks, and the next
              decision.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row md:mt-9">
              <Button asChild variant="premium-primary" size="xl">
                <Link href="/contact">
                  Request pilot access
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="glass-secondary" size="xl">
                <Link href="/features">View operating system</Link>
              </Button>
            </div>
          </div>
          <HeroCommandVisual />
        </div>
      </section>

      <SimpleMarketingModel />
      <LandingVideoShowcase />

      <SafetyStrip />

      <section className="bg-[#08090b] px-5 py-20 text-center md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
            Production-ready path
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Start with the plan. Move to production when it is clear.
          </h2>
          <p className="mt-5 text-base leading-8 text-white/70">
            The product is intentionally approval-led: no confusing dashboard,
            no hidden publishing, and no ad spend without a deliberate gate.
          </p>
          <div className="mt-8">
            <Button asChild variant="premium-primary" size="xl">
              <Link href="/pricing">
                See pilot access
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
