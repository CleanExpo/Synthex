'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Mail,
  MessageCircle,
  Send,
  Shield,
  Sparkles,
} from '@/components/icons';
import { SafetyStrip, SiteShell } from '@/components/landing/public-v2';
import { Button } from '@/components/ui/button';

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

export default function ContactPage() {
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
      <section className="px-5 pb-14 pt-32 md:pb-20 md:pt-40">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
              Request access
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
              Send the idea. Get the next clear step.
            </h1>
            <p className="mt-6 text-lg leading-8 text-white/60">
              Use one form for pilot access, campaign planning or a direct
              question. Synthex starts with the business context and returns a
              controlled path before anything is produced.
            </p>
            <div className="mt-8 grid gap-3">
              <a
                href="mailto:support@synthex.social"
                className="inline-flex items-center gap-3 text-sm text-white/60 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 text-orange-300" />
                support@synthex.social
              </a>
              <p className="inline-flex items-center gap-3 text-sm text-white/45">
                <Clock className="h-4 w-4 text-orange-300" />
                Response target: one business day
              </p>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="border border-white/[0.08] bg-[#0d0f12] p-6 md:p-8"
          >
            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-white/65"
                >
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-white/[0.1] bg-[#08090b] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/28 focus:border-orange-300/60"
                  placeholder="Your name"
                  type="text"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-white/65"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full border border-white/[0.1] bg-[#08090b] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/28 focus:border-orange-300/60"
                  placeholder="you@company.com"
                  type="email"
                />
              </div>

              <div>
                <label
                  htmlFor="subject"
                  className="mb-2 block text-sm font-medium text-white/65"
                >
                  What do you need?
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full border border-white/[0.1] bg-[#08090b] px-4 py-3 text-white outline-none transition-colors focus:border-orange-300/60"
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
                  className="mb-2 block text-sm font-medium text-white/65"
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
                  className="w-full resize-none border border-white/[0.1] bg-[#08090b] px-4 py-3 text-white outline-none transition-colors placeholder:text-white/28 focus:border-orange-300/60"
                  placeholder="Tell us the business, the offer, the idea, the audience or the decision you need help with."
                />
              </div>

              {submitStatus === 'success' && (
                <div className="flex gap-3 border border-emerald-300/25 bg-emerald-300/[0.08] p-4 text-sm text-emerald-200">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>Message received. We will respond with the next step.</p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="border border-red-300/25 bg-red-300/[0.08] p-4 text-sm text-red-200">
                  Something went wrong. Email support@synthex.social directly.
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                variant="premium-primary"
                size="xl"
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Clock className="h-4 w-4 animate-spin" />
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
        </div>
      </section>

      <section className="bg-[#08090b] px-5 pb-20">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          {requestCards.map(item => {
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
              Not ready to request access?
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
              Review the pilot path first.
            </h2>
          </div>
          <Button asChild variant="glass-secondary" size="xl">
            <Link href="/pricing">
              View pilot access
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <SafetyStrip />
    </SiteShell>
  );
}
