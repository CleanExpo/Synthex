'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Shield,
  Sparkles,
} from '@/components/icons';
import {
  PublicGovernanceStrip,
  PublicGradientText,
  PublicPageCtaBand,
  PublicPageFrame,
  PublicPageHero,
  PublicPageSection,
} from '@/components/landing/premium';
import { PublicPageCard } from '@/components/landing/premium/public-page-card';
import { SiteShell } from '@/components/landing/public-v2';
import { SectionReveal } from '@/components/landing/premium/section-reveal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const requestCards = [
  {
    icon: MessageCircle,
    title: 'Pilot access',
    copy: 'Use this when you want Synthex to plan the first campaign path for your business.',
  },
  {
    icon: Sparkles,
    title: 'Campaign idea',
    copy: 'Send the rough idea, offer, audience and channels. We will turn it into clear campaign cards.',
  },
  {
    icon: Shield,
    title: 'Approval gates',
    copy: 'Production, publishing and ad spend stay controlled until the right checks are complete.',
  },
];

const fieldClassName = cn(
  'w-full rounded-input border bg-sx-bg-panel/80 px-4 py-3 text-sm text-sx-text-primary',
  'placeholder:text-sx-text-muted outline-none transition-colors',
  'focus:border-sx-accent/40 focus:ring-1 focus:ring-sx-accent/20',
  'border-white/[0.08]'
);

export default function ContactClient() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'pilot',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        setSubmitStatus('error');
        return;
      }
      setSubmitStatus('success');
      setFormData({ name: '', email: '', subject: 'pilot', message: '' });
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } catch {
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <SiteShell>
      <PublicPageFrame>
        <PublicPageHero
          eyebrow="Request access"
          title={
            <>
              Send the idea. Get the{' '}
              <PublicGradientText>next clear step</PublicGradientText>.
            </>
          }
          description="Use one form for pilot access, campaign planning or a direct question. Synthex starts with the business context and returns a controlled path before anything is produced."
        />

        <PublicPageSection
          className="bg-sx-bg-primary"
          gradientVariant="mid"
          contained={false}
        >
          <div className="mx-auto grid max-w-container gap-10 px-5 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <SectionReveal>
              <div className="space-y-6 lg:sticky lg:top-28">
                <div className="rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 p-6 backdrop-blur-sm">
                  <h2 className="text-lg font-semibold text-sx-text-primary">
                    What to include
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-sx-text-secondary">
                    Business context, offer, audience, channels and the decision
                    you need help with. The more specific the intake, the faster
                    we can return a useful campaign path.
                  </p>
                </div>
                <div className="space-y-3">
                  <a
                    href="mailto:support@synthex.social"
                    className="flex items-center gap-3 text-sm text-sx-text-secondary transition-colors hover:text-sx-text-primary"
                  >
                    <Mail className="h-4 w-4 text-sx-accent" />
                    support@synthex.social
                  </a>
                  <p className="flex items-center gap-3 text-sm text-sx-text-muted">
                    <Clock className="h-4 w-4 text-sx-accent" />
                    Response target: one business day
                  </p>
                </div>
              </div>
            </SectionReveal>

            <SectionReveal delay={80}>
              <form
                onSubmit={handleSubmit}
                className="rounded-card border border-white/[0.1] bg-sx-bg-elevated/95 p-6 shadow-[var(--sx-shadow-elevated)] backdrop-blur-xl md:p-8"
                // @ts-expect-error WebMCP attributes are W3C-draft and not yet in React's type defs
                toolname="submit_contact_enquiry"
                tooldescription="Submit a contact enquiry to SYNTHEX (AI-powered social media management platform). Routes to support@synthex.social for human follow-up within 1 business day. For pilot access, campaign ideas, production questions, and general support."
              >
                <div className="grid gap-5">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-sx-text-muted"
                    >
                      Name
                    </label>
                    <input
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className={fieldClassName}
                      placeholder="Your name"
                      type="text"
                      // @ts-expect-error WebMCP attribute — W3C draft, not yet in React types
                      toolparamdescription="Full name of the enquirer (first and last name preferred)"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-sx-text-muted"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className={fieldClassName}
                      placeholder="you@company.com"
                      type="email"
                      // @ts-expect-error WebMCP attribute — W3C draft, not yet in React types
                      toolparamdescription="Valid business email address where the SYNTHEX team should reply"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="subject"
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-sx-text-muted"
                    >
                      What do you need?
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      required
                      value={formData.subject}
                      onChange={handleChange}
                      className={fieldClassName}
                      // @ts-expect-error WebMCP attribute — W3C draft, not yet in React types
                      toolparamdescription="Enquiry type — one of: pilot (request pilot access), campaign (specific campaign idea or strategy question), production (Gen-Media production question), support (existing-customer support request)"
                    >
                      <option value="pilot">Pilot access</option>
                      <option value="campaign">Campaign idea</option>
                      <option value="production">Production question</option>
                      <option value="support">Support</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-sx-text-muted"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      value={formData.message}
                      onChange={handleChange}
                      rows={6}
                      maxLength={3000}
                      className={cn(fieldClassName, 'resize-none')}
                      placeholder="Tell us the business, the offer, the idea, the audience or the decision you need help with."
                      // @ts-expect-error WebMCP attribute — W3C draft, not yet in React types
                      toolparamdescription="Free-text description of the business context, offer, audience, and what decision or outcome the enquirer needs help with (max 3000 chars)"
                    />
                  </div>

                  {submitStatus === 'success' && (
                    <div className="flex gap-3 rounded-card border border-sx-success/25 bg-sx-success/[0.08] p-4 text-sm text-sx-success">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Message received. We will respond with the next step.
                      </p>
                    </div>
                  )}

                  {submitStatus === 'error' && (
                    <div className="rounded-card border border-red-500/25 bg-red-500/[0.08] p-4 text-sm text-red-300">
                      Something went wrong. Email support@synthex.social
                      directly.
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    variant="premium-primary"
                    size="xl"
                    className="w-full shadow-[0_0_32px_rgba(255,122,24,0.15)]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send request
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </SectionReveal>
          </div>
        </PublicPageSection>

        <PublicPageSection
          className="bg-sx-bg-secondary"
          eyebrow="How we respond"
          title="One intake path. Three common requests."
        >
          <div className="grid gap-4 md:grid-cols-3">
            {requestCards.map((item, index) => (
              <SectionReveal key={item.title} delay={index * 40}>
                <PublicPageCard {...item} index={index} />
              </SectionReveal>
            ))}
          </div>
        </PublicPageSection>

        <PublicPageCtaBand
          eyebrow="Not ready to request access?"
          title="Review the pilot path first."
          href="/pricing"
          label="View pilot access"
        />

        <PublicGovernanceStrip />
      </PublicPageFrame>
    </SiteShell>
  );
}
