import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Calendar, CheckCircle2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import {
  FeatureGrid,
  HeroCommandVisual,
  SafetyStrip,
  SiteShell,
  WorkflowBand,
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
        <div className="relative mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl gap-12 px-5 pb-12 pt-14 lg:grid-cols-[0.88fr_1.12fr] lg:items-center">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 border border-orange-300/25 bg-orange-300/[0.08] px-3 py-2 text-xs uppercase tracking-[0.22em] text-orange-200">
              Controlled pilot · public launch preparing
            </div>
            <h1 className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-tight text-white md:text-7xl">
              Synthex is the marketing command center for campaigns that need
              evidence, approval and ROI.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-white/62">
              Turn a voice note, meeting transcript or product idea into a
              source-backed campaign board: research, strategy, storyboard,
              creative packet, approval gate and learning loop.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
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
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                'Research council',
                'Gen Media studio',
                'Human approval gates',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-white/58">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <HeroCommandVisual />
        </div>
      </section>

      <WorkflowBand />
      <FeatureGrid />

      <section className="bg-[#0d0f12] py-20 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Mobile brief to agency workflow
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
              Built for the founder driving home with an idea.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-white/58">
              Synthex receives the idea, grounds it in the client business,
              pulls the relevant source material, creates the board, and keeps
              production paused until the human gate is clear.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['Input', 'Telegram, Plaud, meeting notes and command-center forms.'],
              ['Grounding', 'Obsidian Wiki, product data, brand rules and market signals.'],
              ['Ideation', 'Website, lead magnet, thumbnail, brand and email concepts.'],
              ['Approval', 'Client review before production, publishing or spend.'],
            ].map(([title, copy]) => (
              <div key={title} className="border border-white/[0.08] bg-[#08090b] p-5">
                <Calendar className="h-5 w-5 text-orange-300" />
                <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/52">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SafetyStrip />

      <section className="bg-[#08090b] px-5 py-20 text-center md:py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
            Production-ready path
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            The public site now matches the product Synthex is becoming.
          </h2>
          <p className="mt-5 text-base leading-8 text-white/58">
            This is not a cheap scheduler. It is the operating layer for a
            marketing agency that researches, plans, creates, gates and learns.
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
