import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Lock,
  Search,
  Shield,
  Sparkles,
  Target,
  Users,
} from '@/components/icons';
import { SafetyStrip, SiteShell } from '@/components/landing/public-v2';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'About Synthex | Synthex',
  description:
    'Synthex is a controlled pilot marketing command center for turning business context, research and ideas into approval-gated campaign production.',
};

const identityCards = [
  {
    icon: BrainCircuit,
    title: 'Agency thinking',
    copy: 'Synthex is designed to behave like a senior marketing team: research first, then plan, then produce only what is approved.',
  },
  {
    icon: Search,
    title: 'Grounded decisions',
    copy: 'Business context, product notes, audience signals, search, social and prior outcomes are linked before recommendations are made.',
  },
  {
    icon: Shield,
    title: 'Controlled output',
    copy: 'Evidence, brand, consent, licensing, publishing and spend gates stay visible so production does not outrun approval.',
  },
];

const operatingPrinciples = [
  'Start with the business context, not a blank prompt.',
  'Keep every campaign step easy for a human to review.',
  'Use AI to compress research and production time, not remove accountability.',
  'Treat provider integrations as gated capabilities, not automatic publishing rights.',
];

const buildCards = [
  {
    icon: Target,
    title: 'What it plans',
    copy: 'Campaign angles, audiences, offers, lead magnets, email paths, website ideas, thumbnails, posts and video storyboards.',
  },
  {
    icon: Users,
    title: 'Who it serves',
    copy: 'Operators and business owners who need agency-grade support without turning every idea into a long manual process.',
  },
  {
    icon: Lock,
    title: 'What stays blocked',
    copy: 'Public publishing, client claims, paid media and provider spend stay blocked until the approval state is explicit.',
  },
];

export default function AboutPage() {
  return (
    <SiteShell>
      <section className="px-5 pb-14 pt-32 md:pb-20 md:pt-40">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
              About Synthex
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
              A marketing command center for controlled campaign creation.
            </h1>
          </div>
          <div className="border border-white/[0.08] bg-[#0d0f12] p-6 md:p-8">
            <Sparkles className="mb-6 h-8 w-8 text-orange-300" />
            <p className="text-lg leading-8 text-white/68">
              Synthex turns rough business ideas into clear campaign cards,
              research packets and production-ready briefs. It is currently a
              controlled pilot product, not a public self-serve platform.
            </p>
            <p className="mt-5 text-sm leading-6 text-white/50">
              The goal is simple: give business owners the feel of a capable
              marketing team while keeping decisions, approvals and risks easy
              to see.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#08090b] px-5 pb-20">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {identityCards.map(item => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="border border-white/[0.08] bg-[#0d0f12] p-6"
              >
                <Icon className="mb-6 h-7 w-7 text-orange-300" />
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  {item.title}
                </h2>
                <p className="mt-4 text-sm leading-6 text-white/55">
                  {item.copy}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-y border-white/[0.08] bg-[#0d0f12] px-5 py-16">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
              Operating model
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-white">
              Less noise. More useful decisions.
            </h2>
          </div>
          <div className="grid gap-3">
            {operatingPrinciples.map(principle => (
              <div
                key={principle}
                className="flex gap-3 border border-white/[0.08] bg-[#08090b] p-4 text-sm leading-6 text-white/62"
              >
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                <span>{principle}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#08090b] px-5 py-20">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {buildCards.map(item => {
            const Icon = item.icon;
            return (
              <article
                key={item.title}
                className="border border-white/[0.08] bg-[#0d0f12] p-6"
              >
                <Icon className="mb-6 h-7 w-7 text-orange-300" />
                <h2 className="text-2xl font-semibold tracking-tight text-white">
                  {item.title}
                </h2>
                <p className="mt-4 text-sm leading-6 text-white/55">
                  {item.copy}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="bg-[#0d0f12] px-5 py-14">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-300">
              Pilot access
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Start with one campaign path.
            </h2>
          </div>
          <Button asChild variant="premium-primary" size="xl">
            <Link href="/contact">
              Request access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <SafetyStrip />
    </SiteShell>
  );
}
