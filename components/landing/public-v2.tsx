import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Globe,
  Lock,
  Search,
  Shield,
  Sparkles,
  Users,
  Video,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const navLinks = [
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pilot Access' },
  { href: '/about', label: 'About' },
  { href: '/login', label: 'Login' },
];

export const workflowStages = [
  {
    label: '01 Research',
    title: 'Evidence bundle',
    copy: 'Obsidian, product data, search, social, competitor and client notes are tied to source refs before strategy is drafted.',
  },
  {
    label: '02 Council',
    title: 'Agency-grade review',
    copy: 'Researcher, architect, brand, compliance and contrarian passes produce a decision packet with risks and open questions.',
  },
  {
    label: '03 Studio',
    title: 'Campaign build',
    copy: 'Synthex turns the approved direction into storyboards, posts, thumbnails, emails, lead magnets and Gen Media briefs.',
  },
  {
    label: '04 Learn',
    title: 'ROI feedback',
    copy: 'Views, clicks, leads, rankings, comments and approvals feed the next campaign instead of disappearing in reports.',
  },
];

export const featurePillars = [
  {
    icon: Search,
    title: 'Market intelligence',
    copy: 'Question-led research across search, social, YouTube, Reddit, competitors and client knowledge.',
  },
  {
    icon: Video,
    title: 'Gen Media command',
    copy: 'Video, post, email, thumbnail and lead-magnet briefs move through storyboard and approval gates.',
  },
  {
    icon: Shield,
    title: 'Approval control',
    copy: 'Consent, evidence, licensing, brand, compliance, publish and spend gates stay explicit.',
  },
  {
    icon: BarChart3,
    title: 'Learning loop',
    copy: 'Campaign outcomes are captured as signal, not just analytics, so the system compounds over time.',
  },
  {
    icon: Users,
    title: 'Client portal flow',
    copy: 'Clients can brief from mobile, review the board, request changes and approve before production.',
  },
  {
    icon: Globe,
    title: 'Multi-channel output',
    copy: 'YouTube, Facebook, LinkedIn, Instagram, Reddit, email and web assets share one strategy spine.',
  },
];

export const pilotPlans = [
  {
    name: 'Founder Pilot',
    price: 'Invite only',
    description: 'For one business proving the command-center workflow.',
    features: [
      'Business and product knowledge intake',
      'Research council campaign brief',
      'Storyboard and content approval packet',
      'One active channel workflow',
      'Human approval before public output',
    ],
    cta: 'Request Pilot Access',
    href: '/contact',
    tone: 'quiet',
  },
  {
    name: 'Client Command',
    price: 'Scoped retainer',
    description: 'For operators running recurring campaigns with Synthex.',
    features: [
      'Monthly campaign ideation package',
      'Website, lead magnet and email planning',
      'Thumbnail, post and video concept generation',
      'Performance review and next-action loop',
      'Provider-gated media production',
    ],
    cta: 'Discuss Retainer',
    href: '/contact',
    tone: 'primary',
  },
  {
    name: 'Agency System',
    price: 'Custom',
    description: 'For multi-client teams needing command-center governance.',
    features: [
      'Client workspaces and approval lanes',
      'Brand, evidence and compliance gates',
      'Research council packet history',
      'White-label presentation outputs',
      'Senior operator onboarding',
    ],
    cta: 'Plan Agency Rollout',
    href: '/contact',
    tone: 'quiet',
  },
];

export function PublicNav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#08090b]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3" aria-label="Synthex home">
          <SynthexMark />
          <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white">
            Synthex
          </span>
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-white/62 transition-colors hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Button asChild variant="premium-primary" size="lg">
          <Link href="/contact">
            Request access
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#08090b]">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <SynthexMark />
            <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white">
              Synthex
            </span>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/55">
            Evidence-backed marketing command center for research, campaign
            planning, Gen Media production and approval-gated execution.
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            ['Features', '/features'],
            ['Pilot Access', '/pricing'],
            ['Dashboard', '/dashboard'],
            ['Security', '/security'],
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            ['About', '/about'],
            ['Contact', '/contact'],
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
          ]}
        />
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/[0.06] px-5 py-5 text-xs text-white/35 md:flex-row md:items-center md:justify-between">
        <span>© 2026 Synthex Pty Ltd. Controlled pilot access.</span>
        <span>Production publishing and ad spend require explicit approval.</span>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<[string, string]>;
}) {
  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/35">
        {title}
      </p>
      <ul className="space-y-3">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-sm text-white/55 transition-colors hover:text-white"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SynthexMark() {
  return (
    <span className="grid h-9 w-9 place-items-center border border-orange-400/35 bg-orange-400/[0.08] text-orange-300">
      <Sparkles className="h-4 w-4" />
    </span>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#08090b] text-white">
      <PublicNav />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

export function HeroCommandVisual() {
  return (
    <div className="relative border border-white/[0.1] bg-[#101216] p-3 shadow-2xl shadow-black/40">
      <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="border border-white/[0.08] bg-[#0b0c0f] p-4">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.24em] text-white/38">
              Command Packet
            </span>
            <span className="border border-emerald-400/25 bg-emerald-400/[0.08] px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
              Draft only
            </span>
          </div>
          <h2 className="text-xl font-semibold leading-tight text-white">
            APT meters launch campaign for CCW
          </h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Voice note captured from mobile. Synthex is assembling product,
            audience, search and channel evidence before creative production.
          </p>
          <div className="mt-6 space-y-2">
            {[
              ['source:board-input', 'Ready'],
              ['wiki:client-products', 'Linked'],
              ['gate:human-review', 'Required'],
              ['risk:public-claims', 'Open'],
            ].map(([label, state]) => (
              <div
                key={label}
                className="flex items-center justify-between border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
              >
                <span className="text-white/48">{label}</span>
                <span className="text-white/75">{state}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Evidence" value="14" detail="refs" />
            <Metric label="Risk" value="3" detail="open" />
            <Metric label="ROI Loop" value="On" detail="tracked" />
          </div>
          <div className="border border-white/[0.08] bg-[#0b0c0f] p-4">
            <p className="mb-4 text-xs uppercase tracking-[0.24em] text-white/38">
              Agency flow
            </p>
            <div className="space-y-3">
              {workflowStages.map((stage, index) => (
                <div key={stage.label} className="flex gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center border border-orange-300/30 text-xs text-orange-200">
                    {index + 1}
                  </div>
                  <div className="min-w-0 border-b border-white/[0.06] pb-3">
                    <p className="text-sm font-medium text-white">{stage.title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/48">
                      {stage.copy}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-white/[0.08] bg-[#0b0c0f] p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="text-xs text-white/45">{detail}</p>
    </div>
  );
}

export function WorkflowBand() {
  return (
    <section className="border-y border-white/[0.08] bg-[#0d0f12] py-16">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mb-9 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
            ADLC command flow
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
            The agency process becomes visible before money is spent.
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {workflowStages.map(stage => (
            <Card key={stage.label} variant="glass" className="p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-orange-300/80">
                {stage.label}
              </p>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {stage.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/55">{stage.copy}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid() {
  return (
    <section className="bg-[#08090b] py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Built like a senior agency
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Research, creative, approval and learning in one operating layer.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-white/52">
            Synthex does not replace judgement. It gives the operator a
            structured board, evidence trail and production path.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {featurePillars.map(feature => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} variant="glass" className="p-5">
                <Icon className="h-6 w-6 text-orange-300" />
                <h3 className="mt-5 text-lg font-semibold text-white">
                  {feature.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/55">
                  {feature.copy}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SafetyStrip() {
  const items = [
    'No public publishing without approval',
    'No ad spend without explicit gate',
    'No client claims without evidence',
    'No provider keys exposed in UI',
  ];

  return (
    <section className="bg-[#f4efe8] py-14 text-[#101216]">
      <div className="mx-auto max-w-7xl px-5">
        <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-center">
          <div>
            <Lock className="h-7 w-7 text-[#9a4f16]" />
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Production stays controlled.
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {items.map(item => (
              <div
                key={item}
                className="flex items-center gap-3 border border-[#101216]/10 bg-white px-4 py-3 text-sm"
              >
                <CheckCircle2 className="h-5 w-5 text-[#357a4d]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
