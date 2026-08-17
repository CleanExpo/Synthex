import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Lock } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FinalCta } from './final-cta';
import { SectionAtmosphere } from './section-atmosphere';

type AtmosphereVariant = 'hero' | 'ember' | 'evidence' | 'cta' | 'ink';

const gradientToAtmosphere: Record<
  'hero' | 'mid' | 'lower' | 'cta',
  AtmosphereVariant
> = {
  hero: 'hero',
  mid: 'ember',
  lower: 'evidence',
  cta: 'cta',
};

interface PublicPageHeroProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  gradientVariant?: keyof typeof gradientToAtmosphere;
  children?: ReactNode;
}

export function PublicPageHero({
  eyebrow,
  title,
  description,
  gradientVariant = 'hero',
  children,
}: PublicPageHeroProps) {
  return (
    <section
      className="relative overflow-hidden pt-28 pb-16 md:pb-20"
      style={{ background: 'var(--sx-gradient-hero)' }}
    >
      <SectionAtmosphere
        variant={gradientToAtmosphere[gradientVariant]}
        scanlines
        noise
      />
      <div className="landing-hero-dot-grid absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sx-bg-primary/80 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-7xl px-5">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-[1.06] tracking-[-0.03em] text-sx-text-primary sm:text-5xl md:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-sx-text-secondary md:text-lg">
            {description}
          </p>
          {children ? (
            <div className="mt-8 flex flex-wrap gap-3">{children}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

interface PublicPageSectionProps {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
  gradientVariant?: keyof typeof gradientToAtmosphere;
  contained?: boolean;
}

export function PublicPageSection({
  id,
  eyebrow,
  title,
  description,
  children,
  className,
  gradientVariant,
  contained = true,
}: PublicPageSectionProps) {
  return (
    <section
      id={id}
      className={cn('relative overflow-hidden py-20 md:py-28', className)}
    >
      {gradientVariant ? (
        <SectionAtmosphere variant={gradientToAtmosphere[gradientVariant]} />
      ) : null}
      <div className={cn('relative', contained && 'mx-auto max-w-7xl px-5')}>
        {(eyebrow || title || description) && (
          <div className="mb-12 max-w-2xl">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
                {eyebrow}
              </p>
            ) : null}
            {title ? (
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-4xl">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-4 text-base leading-8 text-sx-text-secondary">
                {description}
              </p>
            ) : null}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

interface PublicPageStatProps {
  value: string;
  label: string;
}

export function PublicPageStatGrid({
  stats,
}: {
  stats: PublicPageStatProps[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(stat => (
        <div
          key={stat.label}
          className="min-w-0 rounded-2xl border border-white/[0.08] bg-sx-bg-elevated px-5 py-6 text-center"
        >
          <p className="text-2xl font-semibold tracking-tight text-sx-text-primary md:text-3xl">
            {stat.value}
          </p>
          <p className="mt-1 text-sm text-sx-text-muted">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}

export function PublicGovernanceStrip() {
  const items = [
    'No public publishing without approval',
    'No ad spend without explicit gate',
    'No client claims without evidence',
    'No provider keys exposed in UI',
  ];

  return (
    <section className="relative overflow-hidden border-y border-white/[0.06] bg-sx-bg-secondary py-16">
      <SectionAtmosphere variant="evidence" />
      <div className="relative mx-auto grid max-w-7xl gap-8 px-5 md:grid-cols-[0.85fr_1.15fr] md:items-center">
        <div className="min-w-0">
          <Lock className="h-7 w-7 text-sx-accent" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-sx-text-primary">
            Production stays controlled.
          </h2>
          <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
            Every public page reflects the same operating principle: evidence
            first, human approval before output.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map(item => (
            <div
              key={item}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/[0.08] bg-sx-bg-elevated px-4 py-3.5 text-sm text-sx-text-primary"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-sx-success" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

interface PublicPageFaqProps {
  title?: string;
  items: Array<{ question: string; answer: string }>;
}

export function PublicPageFaq({
  title = 'Common questions',
  items,
}: PublicPageFaqProps) {
  return (
    <PublicPageSection
      className="bg-sx-bg-secondary"
      gradientVariant="lower"
      eyebrow="FAQ"
      title={title}
    >
      <dl className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-sx-bg-elevated">
        {items.map(faq => (
          <div key={faq.question} className="p-6">
            <dt className="text-lg font-semibold text-sx-text-primary">
              {faq.question}
            </dt>
            <dd className="mt-3 text-sm leading-7 text-sx-text-secondary">
              {faq.answer}
            </dd>
          </div>
        ))}
      </dl>
    </PublicPageSection>
  );
}

interface PublicPageCtaBandProps {
  eyebrow?: string;
  title: string;
  description?: string;
  href?: string;
  label?: string;
}

export function PublicPageCtaBand({
  eyebrow = 'Next step',
  title,
  description,
  href = '/contact',
  label = 'Request a pilot',
}: PublicPageCtaBandProps) {
  return (
    <PublicPageSection className="bg-sx-bg-primary" gradientVariant="mid">
      <div className="flex flex-col gap-6 rounded-2xl border border-white/[0.08] bg-sx-bg-elevated p-8 md:flex-row md:items-center md:justify-between md:p-10">
        <div className="max-w-2xl min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sx-accent">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary">
            {title}
          </h2>
          {description ? (
            <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        <Button
          asChild
          variant="premium-primary"
          size="xl"
          className="shrink-0"
        >
          <Link href={href}>
            {label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </PublicPageSection>
  );
}

export function PublicPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <FinalCta />
    </div>
  );
}

export function PublicGradientText({ children }: { children: ReactNode }) {
  return <span className="landing-gradient-text">{children}</span>;
}
