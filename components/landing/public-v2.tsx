import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Globe,
  ImageIcon,
  Lock,
  Megaphone,
  Mic,
  Search,
  Shield,
  Sparkles,
  Target,
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
    copy: 'Obsidian, product data, search, social, competitor and business notes are tied to source refs before strategy is drafted.',
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
    title: 'Review portal flow',
    copy: 'Operators can brief from mobile, review the board, request changes and approve before production.',
  },
  {
    icon: Globe,
    title: 'Multi-channel output',
    copy: 'YouTube, Facebook, LinkedIn, Instagram, Reddit, email and web assets share one strategy spine.',
  },
];

export const commandCenterLanes = [
  {
    icon: Mic,
    label: 'Client input',
    title: 'Voice brief captured',
    copy: 'A founder, operator or client sends the raw idea from mobile, meeting notes, Plaud, Telegram or WhatsApp intake.',
    state: 'Intake',
  },
  {
    icon: BrainCircuit,
    label: 'Ontology',
    title: 'Business context linked',
    copy: 'Products, offers, audience notes, Wiki context, channel access and historical outcomes are linked before strategy.',
    state: 'Grounded',
  },
  {
    icon: Search,
    label: 'Research',
    title: 'Market signal checked',
    copy: 'Search, YouTube, social, Reddit, competitors, local events and trend signals shape the campaign hypothesis.',
    state: 'Verified',
  },
  {
    icon: Target,
    label: 'Board',
    title: 'Agency council decides',
    copy: 'Brand, creative, compliance, SEO/AEO/GEO, video and QA passes produce the next best campaign route.',
    state: 'Approved',
  },
  {
    icon: ImageIcon,
    label: 'Studio',
    title: 'Assets move to production',
    copy: 'Website copy, lead magnets, thumbnails, email campaigns, posts and video storyboards become reviewable media.',
    state: 'Queued',
  },
  {
    icon: Megaphone,
    label: 'Launch',
    title: 'Gated distribution',
    copy: 'Publishing, spend and public claims stay blocked until evidence, licensing and human approval are complete.',
    state: 'Controlled',
  },
];

export const deliverableRail = [
  'Website creation',
  'Lead magnets',
  'Thumbnail systems',
  'Brand planning',
  'Email campaigns',
  'Video storyboards',
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
          <p className="max-w-md text-sm leading-6 text-white/70">
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
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/[0.06] px-5 py-5 text-xs text-white/65 md:flex-row md:items-center md:justify-between">
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
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/65">
        {title}
      </p>
      <ul className="space-y-3">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-sm text-white/70 transition-colors hover:text-white"
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
      <div>{children}</div>
      <PublicFooter />
    </div>
  );
}

export function HeroCommandVisual() {
  return (
    <div className="relative border border-white/[0.1] bg-[#101216] p-3 shadow-2xl shadow-black/40">
      <div className="grid gap-3">
        {[
          {
            label: '1. Input',
            title: 'Send the rough idea',
            copy: 'Voice note, meeting notes, product brief or campaign thought.',
            icon: Mic,
          },
          {
            label: '2. Plan',
            title: 'Review the campaign cards',
            copy: 'Audience, offer, assets, risks and approval gates in plain view.',
            icon: BrainCircuit,
          },
          {
            label: '3. Produce',
            title: 'Approve what gets made',
            copy: 'Move into video, posts, email, website or lead magnet production.',
            icon: CheckCircle2,
          },
        ].map(item => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="border border-white/[0.08] bg-[#0b0c0f] p-5"
            >
              <div className="mb-5 flex items-center justify-between gap-4">
                <span className="text-xs uppercase tracking-[0.22em] text-orange-200">
                  {item.label}
                </span>
                <Icon className="h-5 w-5 text-white/70" />
              </div>
              <h2 className="text-xl font-semibold leading-tight text-white">
                {item.title}
              </h2>
              <p className="mt-3 text-sm leading-6 text-white/70">{item.copy}</p>
            </article>
          );
        })}
      </div>
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
              <p className="text-xs uppercase tracking-[0.2em] text-orange-200">
                {stage.label}
              </p>
              <h3 className="mt-4 text-lg font-semibold text-white">
                {stage.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/70">{stage.copy}</p>
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
          <p className="max-w-md text-sm leading-6 text-white/70">
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
                <p className="mt-3 text-sm leading-6 text-white/70">
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

export function CommandCenterExperience() {
  return (
    <section className="bg-[#101216] py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
              Client-facing experience
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
              The idea arrives messy. The board makes it usable.
            </h2>
            <p className="mt-5 text-base leading-8 text-white/70">
              Synthex should feel like a calm senior agency operating in the
              background: capture the rough brief, connect the business context,
              show the work, and only move to production when the client can see
              what they are approving.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {deliverableRail.map(item => (
                <span
                  key={item}
                  className="border border-white/[0.1] bg-white/[0.04] px-3 py-2 text-xs text-white/64"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {commandCenterLanes.map((lane, index) => {
              const Icon = lane.icon;
              return (
                <article
                  key={lane.title}
                  className="group border border-white/[0.08] bg-[#0a0c0f] p-5 transition-colors hover:border-orange-300/30 hover:bg-[#0d1014]"
                >
                  <div className="mb-7 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center border border-orange-300/25 bg-orange-300/[0.08] text-orange-200">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="text-xs uppercase tracking-[0.22em] text-white/65">
                        {lane.label}
                      </span>
                    </div>
                    <span className="text-xs text-white/65">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-white">
                    {lane.title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-white/70">{lane.copy}</p>
                  <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4">
                    <span className="text-xs uppercase tracking-[0.18em] text-white/65">
                      Status
                    </span>
                    <span className="border border-emerald-300/25 bg-emerald-300/[0.08] px-2.5 py-1 text-xs text-emerald-200">
                      {lane.state}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export function SimpleMarketingModel() {
  const cards = [
    {
      icon: Mic,
      title: 'Tell us the idea',
      copy: 'Speak it, paste it or drop in notes. Synthex turns the rough input into a usable brief.',
      list: ['Voice notes', 'Meeting notes', 'Product ideas'],
    },
    {
      icon: Search,
      title: 'Get the plan',
      copy: 'The output is card-based: audience, offer, channels, assets, risks and next decision.',
      list: ['Research', 'Storyboards', 'Approvals'],
    },
    {
      icon: ImageIcon,
      title: 'Make the assets',
      copy: 'Move only the approved cards into production for the channels that matter.',
      list: ['Website', 'Lead magnets', 'Thumbnails', 'Email', 'Video'],
    },
  ];

  return (
    <section className="border-y border-white/[0.08] bg-[#101216] py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-5">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
            Simple model
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            Three cards. No maze.
          </h2>
          <p className="mt-5 text-base leading-8 text-white/70">
            The product should be obvious from the first screen: input the idea,
            review the plan, approve production.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <article
                key={card.title}
                className="border border-white/[0.08] bg-[#0a0c0f] p-6"
              >
                <Icon className="h-7 w-7 text-orange-300" />
                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-white">
                  {card.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-white/70">{card.copy}</p>
                <div className="mt-7 flex flex-wrap gap-2">
                  {card.list.map(item => (
                    <span
                      key={item}
                      className="border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-white/70"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function LandingVideoShowcase() {
  return (
    <section className="bg-[#0d0f12] py-20 md:py-24">
      <div className="mx-auto grid max-w-7xl gap-9 px-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-orange-300">
            Watch the command center
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white md:text-5xl">
            See how Synthex turns market signal into approved media.
          </h2>
          <p className="mt-5 max-w-xl text-base leading-8 text-white/70">
            The landing video shows the buyer journey without promising
            automated publishing: evidence comes first, production stays gated,
            and ROI feedback drives the next campaign.
          </p>
          <div className="mt-7 grid gap-3 text-sm text-white/70 sm:grid-cols-2">
            {[
              'Research before creative',
              'Storyboard before spend',
              'Approval before publishing',
              'Learning after launch',
            ].map(item => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-hidden border border-white/[0.1] bg-[#08090b] p-3 shadow-2xl shadow-black/40">
          <video
            className="aspect-video w-full bg-black object-cover"
            poster="/videos/synthex-command-center-demo-poster.webp"
            muted
            playsInline
            controls
            preload="none"
            aria-label="Synthex command center demo video"
          >
            <source
              src="/videos/synthex-command-center-demo.webm"
              type="video/webm"
            />
            <source
              src="/videos/synthex-command-center-demo.mp4"
              type="video/mp4"
            />
            Synthex command center demo video.
          </video>
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
