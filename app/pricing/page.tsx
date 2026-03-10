import type { Metadata } from 'next';
import Link from 'next/link';
import { PAGE_METADATA } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = PAGE_METADATA.pricing;
import { Check, X } from '@/components/icons';
import { CheckoutButton } from '@/components/stripe/checkout-button';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { PricingGrid } from '@/components/pricing/pricing-grid';

const pricingFaqs = [
  {
    question: 'Can I change plans anytime?',
    answer: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.',
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards, PayPal, and wire transfers for Enterprise plans.',
  },
  {
    question: 'Is there a free trial?',
    answer: 'Yes, all plans come with a 14-day free trial. No credit card required to start.',
  },
  {
    question: 'Can I cancel anytime?',
    answer: 'Absolutely. You can cancel your subscription at any time with no cancellation fees.',
  },
];

function PricingFAQSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pricingFaqs.map((faq) => ({
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
      {/* Hero Section */}
      <section className="pt-16 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Choose the perfect plan for your social media growth. All plans include our core AI features.
          </p>
        </div>
      </section>

      {/* Pricing Cards — includes billing toggle (client component) */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <PricingGrid />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center text-white mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            {[
              {
                q: 'Can I change plans anytime?',
                a: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept all major credit cards, PayPal, and wire transfers for Enterprise plans.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes, all plans come with a 14-day free trial. No credit card required to start.',
              },
              {
                q: 'Can I cancel anytime?',
                a: 'Absolutely. You can cancel your subscription at any time with no cancellation fees.',
              },
            ].map((faq) => (
              <Card key={faq.q} variant="glass" className="p-6 bg-surface-base/80 backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/20 transition-all duration-300">
                <h3 className="text-lg font-semibold text-white mb-2">{faq.q}</h3>
                <p className="text-gray-400">{faq.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card variant="glass-primary" className="p-12 text-center bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 backdrop-blur-sm border border-cyan-500/20">
            <h2 className="text-3xl font-bold text-white mb-4">
              Start Your 14-Day Free Trial
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              No credit card required. Cancel anytime.
            </p>
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-10 py-6 text-lg font-medium shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all duration-300">
                Get Started Now
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
