'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, Lock } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FinalCta } from './final-cta';
import { LandingPageAmbient } from './floating-gradients';
import { SectionFloatingGradients } from './floating-gradients';
import { SectionReveal } from './section-reveal';

type GradientVariant = 'hero' | 'mid' | 'lower' | 'cta';

interface PublicPageHeroProps {
  eyebrow: string;
  title: ReactNode;
  description: string;
  gradientVariant?: GradientVariant;
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
      <SectionFloatingGradients variant={gradientVariant} dense />
      <div className="landing-hero-dot-grid absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sx-bg-primary/80 to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto max-w-container px-5">
        <SectionReveal>
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
        </SectionReveal>
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
  gradientVariant?: GradientVariant;
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
        <SectionFloatingGradients variant={gradientVariant} />
      ) : null}
      <div
        className={cn('relative', contained && 'mx-auto max-w-container px-5')}
      >
        {(eyebrow || title || description) && (
          <SectionReveal>
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
          </SectionReveal>
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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <SectionReveal key={stat.label} delay={index * 40}>
          <div className="rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 px-5 py-6 text-center backdrop-blur-sm">
            <p className="text-2xl font-semibold tracking-tight text-sx-text-primary md:text-3xl">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-sx-text-muted">{stat.label}</p>
          </div>
        </SectionReveal>
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
      <SectionFloatingGradients variant="lower" />
      <div className="relative mx-auto grid max-w-container gap-8 px-5 md:grid-cols-[0.85fr_1.15fr] md:items-center">
        <div>
          <Lock className="h-7 w-7 text-sx-accent" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight text-sx-text-primary">
            Production stays controlled.
          </h2>
          <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
            Every public page reflects the same operating principle: evidence
            first, human approval before output.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(item => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 px-4 py-3.5 text-sm text-sx-text-primary"
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
      <dl className="divide-y divide-white/[0.06] rounded-card border border-white/[0.08] bg-sx-bg-elevated">
        {items.map((faq, index) => (
          <SectionReveal key={faq.question} delay={index * 30}>
            <div className="p-6">
              <dt className="text-lg font-semibold text-sx-text-primary">
                {faq.question}
              </dt>
              <dd className="mt-3 text-sm leading-7 text-sx-text-secondary">
                {faq.answer}
              </dd>
            </div>
          </SectionReveal>
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
  label = 'Request pilot access',
}: PublicPageCtaBandProps) {
  return (
    <PublicPageSection className="bg-sx-bg-primary" gradientVariant="mid">
      <SectionReveal>
        <div className="flex flex-col gap-6 rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 p-8 md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-2xl">
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
      </SectionReveal>
    </PublicPageSection>
  );
}

export function PublicPageFrame({ children }: { children: ReactNode }) {
  return (
    <>
      <LandingPageAmbient />
      <div className="relative">{children}</div>
      <FinalCta />
    </>
  );
}

export function PublicGradientText({ children }: { children: ReactNode }) {
  return <span className="landing-gradient-text">{children}</span>;
}
