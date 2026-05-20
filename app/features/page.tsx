import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ImageIcon,
  Mic,
  Search,
  Shield,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SafetyStrip, SiteShell } from '@/components/landing/public-v2';

export const metadata: Metadata = {
  title: 'Features | Synthex',
  description:
    'Explore Synthex command-center features for market research, campaign planning, Gen Media production, approvals and ROI learning.',
};

const featureCards = [
  {
    icon: Mic,
    eyebrow: 'Input',
    title: 'Capture the idea',
    copy: 'Start from a voice note, meeting transcript, product thought or rough campaign brief.',
    points: [
      'Voice and text intake',
      'Business context attached',
      'No blank content form',
    ],
  },
  {
    icon: Search,
    eyebrow: 'Research',
    title: 'Ground the plan',
    copy: 'Connect the idea to evidence before creative work starts.',
    points: [
      'Search and social signals',
      'Competitor and audience notes',
      'Confidence and open questions',
    ],
  },
  {
    icon: ImageIcon,
    eyebrow: 'Assets',
    title: 'Choose what gets made',
    copy: 'Review cards for the assets that matter instead of navigating disconnected tools.',
    points: [
      'Website pages',
      'Lead magnets',
      'Thumbnails, emails and video',
    ],
  },
  {
    icon: Shield,
    eyebrow: 'Approval',
    title: 'Keep control',
    copy: 'Claims, spend, publishing and licensed media stay blocked until the approval gate is clear.',
    points: [
      'Human review',
      'Licensing checks',
      'No hidden publishing',
    ],
  },
  {
    icon: BarChart3,
    eyebrow: 'Learning',
    title: 'Improve the next campaign',
    copy: 'Outcomes become signal for the next card set, not a report that gets forgotten.',
    points: [
      'Views, clicks and leads',
      'Channel notes',
      'Next action cards',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <SiteShell>
      <section className="bg-[#08090b] px-5 pb-16 pt-32">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Platform features
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
              Features should feel like cards, not a maze.
            </h1>
            <p className="mt-6 text-lg leading-8 text-white/60">
              Synthex is easiest to understand as five steps: capture the idea,
              ground the plan, choose assets, approve production and learn from
              the outcome.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#08090b] px-5 pb-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {featureCards.map((group, index) => {
              const Icon = group.icon;
              return (
                <article
                  key={group.title}
                  className="border border-white/[0.08] bg-[#0d0f12] p-5"
                >
                  <div className="mb-6 flex items-center justify-between">
                    <Icon className="h-6 w-6 text-orange-300" />
                    <span className="text-xs text-white/35">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <p className="text-xs uppercase tracking-[0.22em] text-orange-300/80">
                    {group.eyebrow}
                  </p>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight text-white">
                    {group.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/55">
                    {group.copy}
                  </p>
                  <ul className="mt-5 space-y-3">
                    {group.points.map(point => (
                      <li
                        key={point}
                        className="flex gap-3 text-sm leading-6 text-white/58"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <SafetyStrip />

      <section className="bg-[#08090b] px-5 py-20 text-center md:py-24">
        <h2 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
          Built for controlled launch, then scale.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-white/58">
          The interface stays simple while the work behind it stays serious:
          every card can carry evidence, approval state, production cost and
          next action.
        </p>
        <div className="mt-8">
          <Button asChild variant="premium-primary" size="xl">
            <Link href="/pricing">
              Review pilot packages
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}
