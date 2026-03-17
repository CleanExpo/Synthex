import type { Metadata } from 'next';
import Link from 'next/link';
import { PAGE_METADATA } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = PAGE_METADATA.pricing;
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { PricingSection } from '@/components/landing/pricing-section';

const pricingFaqs = [
  {
    question: 'Can I change plans anytime?',
    answer:
      'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and any unused credit is prorated to your next billing cycle.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major credit cards (Visa, Mastercard, Amex) and bank transfers for Agency and Enterprise plans. All prices are in AUD.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes, all paid plans come with a 14-day free trial. No credit card required to start — just sign up and explore the full feature set.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Absolutely. You can cancel your subscription at any time with no cancellation fees. Your access continues until the end of the current billing period.',
  },
  {
    question: 'What social platforms does Synthex support?',
    answer:
      'Pro and Agency plans support all 9 platforms: Instagram, TikTok, Twitter/X, LinkedIn, Facebook, YouTube, Pinterest, Reddit, and Threads. Starter plans connect up to 3 platforms of your choice.',
  },
  {
    question: 'How does AI voice training work?',
    answer:
      "You provide sample posts written in your brand's tone, and Synthex trains a personalised AI voice model on that style. Starter plans support up to 30 sample posts; Pro and above support unlimited samples.",
  },
  {
    question: 'What is included in Agency white-label reports?',
    answer:
      'Agency plans can generate branded PDF performance reports with your agency logo and colour scheme. These are designed to be sent directly to clients, with no Synthex branding visible.',
  },
  {
    question: 'Do you offer discounts for non-profits or startups?',
    answer:
      'Yes. We offer tailored pricing for registered non-profits and early-stage startups. Contact us at support@synthex.com.au to discuss eligibility.',
  },
];

function PricingFAQSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pricingFaqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function PricingPage() {
  return (
    <MarketingLayout currentPage="pricing">
      <PricingFAQSchema />
      {/* Pricing Cards — includes billing toggle and hero (client component) */}
      <section className="pt-16 pb-20 px-6">
        <PricingSection
          description={
            'Choose the perfect plan for your social media growth.\nAll plans include a 14-day free trial.'
          }
        />
      </section>

      {/* FAQ Section */}
      <section className="py-20 md:py-28 px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {pricingFaqs.map(faq => (
              <Card
                key={faq.question}
                variant="glass"
                className="p-6 bg-surface-base/80 backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/20 transition-all duration-300"
              >
                <h3 className="text-lg font-semibold text-white mb-2">
                  {faq.question}
                </h3>
                <p className="text-gray-400">{faq.answer}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card
            variant="glass-primary"
            className="p-12 text-center bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 backdrop-blur-sm border border-cyan-500/20"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Start Your 14-Day Free Trial
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              No credit card required. Cancel anytime.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-10 py-6 text-lg font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300"
              >
                Get Started Now
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
