'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Send } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const fieldClassName = cn(
  'w-full rounded-input border bg-sx-bg-panel/80 px-4 py-3 text-sm text-sx-text-primary',
  'placeholder:text-sx-text-muted outline-none transition-colors',
  'focus:border-sx-accent/40 focus:ring-1 focus:ring-sx-accent/20',
  'border-white/[0.08]'
);

export function ContactForm() {
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
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-white/[0.1] bg-sx-bg-elevated p-6 shadow-[var(--sx-shadow-elevated)] md:p-8"
      // @ts-expect-error WebMCP attributes are W3C-draft and not yet in React's type defs
      toolname="submit_contact_enquiry"
      tooldescription="Submit a contact enquiry to SYNTHEX. Routes to support@synthex.social for human follow-up within 1 business day."
    >
      <div className="grid gap-5">
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-sx-text-muted"
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
          />
        </div>
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-sx-text-muted"
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
          />
        </div>
        <div>
          <label
            htmlFor="subject"
            className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-sx-text-muted"
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
            className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.22em] text-sx-text-muted"
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
          />
        </div>
        {submitStatus === 'success' && (
          <div className="flex gap-3 rounded-card border border-sx-success/25 bg-sx-success/[0.08] p-4 text-sm text-sx-success">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Message received. We will respond with the next step.</p>
          </div>
        )}
        {submitStatus === 'error' && (
          <div className="rounded-card border border-red-500/25 bg-red-500/[0.08] p-4 text-sm text-red-300">
            Something went wrong. Email support@synthex.social directly.
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
  );
}
