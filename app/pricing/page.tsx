import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, X } from '@/components/icons';
import { CheckoutButton } from '@/components/stripe/checkout-button';
import MarketingLayout from '@/components/marketing/MarketingLayout';

const plans = [
  {
    name: 'Professional',
    price: '$249',
    description: 'Perfect for professionals and content creators',
    features: [
      '5 social media accounts',
      '100 AI-generated posts/month',
      'Professional analytics',
      'Email support',
      '3 persona profiles',
      'Smart scheduling',
      'Content library access',
      'Basic automation',
    ],
    notIncluded: [
      'Advanced pattern analysis',
      'Custom AI training',
      'Team collaboration',
      'Priority support',
    ],
  },
  {
    name: 'Business',
    price: '$399',
    popular: true,
    description: 'For businesses and marketing teams',
    features: [
      '10 social media accounts',
      'Unlimited AI-generated posts',
      'Advanced analytics & insights',
      'Priority email & chat support',
      '10 persona profiles',
      'Smart scheduling with AI optimization',
      'Viral pattern analysis',
      'Custom AI training',
      'Competitor analysis',
      'A/B testing tools',
      'Team collaboration tools',
      'Brand voice customization',
    ],
    notIncluded: [
      'White-label solution',
      'Dedicated account manager',
      'API access',
    ],
  },
  {
    name: 'Custom',
    price: 'Custom',
    description: 'Enterprise solutions tailored to your needs',
    features: [
      'Unlimited social media accounts',
      'Unlimited AI-generated posts',
      'Enterprise analytics suite',
      'Dedicated account manager',
      'Unlimited persona profiles',
      'Custom AI model training',
      'Full API access',
      'White-label solution',
      'SLA guarantee',
      'Custom integrations',
      'On-premise deployment option',
      'Advanced security features',
      'Custom workflows',
      'Priority development',
    ],
    notIncluded: [],
  },
];

export default function PricingPage() {
  return (
    <MarketingLayout currentPage="pricing">
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

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                variant={plan.popular ? 'glass-primary' : 'glass'}
                className={`p-8 relative bg-[#0f172a]/80 backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 transition-all duration-300 ${
                  plan.popular ? 'scale-105 border-cyan-500/30 shadow-lg shadow-cyan-500/10' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg shadow-cyan-500/25">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-gray-500">/month</span>}
                  </div>
                  <p className="text-gray-500 text-sm">{plan.description}</p>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map((feature) => (
                    <div key={feature} className="flex items-start space-x-3 opacity-50">
                      <X className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-600 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {plan.price === 'Custom' ? (
                  <Link href="/contact" className="block">
                    <Button
                      className="w-full bg-[#0a1628] border border-cyan-500/20 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/40 transition-all duration-300"
                      size="lg"
                    >
                      Contact Sales
                    </Button>
                  </Link>
                ) : (
                  <CheckoutButton
                    planName={plan.name}
                    className={`w-full ${
                      plan.popular
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40'
                        : 'bg-[#0a1628] border border-cyan-500/20 text-gray-300 hover:bg-cyan-500/10 hover:text-cyan-400 hover:border-cyan-500/40'
                    } transition-all duration-300`}
                  >
                    Start Free Trial
                  </CheckoutButton>
                )}
              </Card>
            ))}
          </div>
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
              <Card key={faq.q} variant="glass" className="p-6 bg-[#0f172a]/80 backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/20 transition-all duration-300">
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
