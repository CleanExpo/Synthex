import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, X, Sparkles } from 'lucide-react';

const plans = [
  {
    name: 'Starter',
    price: '$29',
    description: 'Perfect for individuals and small creators',
    features: [
      '3 social media accounts',
      '30 AI-generated posts/month',
      'Basic analytics',
      'Email support',
      '1 persona profile',
      'Standard scheduling',
    ],
    notIncluded: [
      'Advanced pattern analysis',
      'Custom AI training',
      'API access',
      'Priority support',
    ],
  },
  {
    name: 'Pro',
    price: '$99',
    popular: true,
    description: 'For growing businesses and agencies',
    features: [
      '10 social media accounts',
      'Unlimited AI-generated posts',
      'Advanced analytics & insights',
      'Priority email & chat support',
      '5 persona profiles',
      'Smart scheduling with AI optimization',
      'Viral pattern analysis',
      'Custom AI training',
      'Competitor analysis',
      'A/B testing tools',
    ],
    notIncluded: [
      'White-label solution',
      'Dedicated account manager',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For large teams and organizations',
    features: [
      'Unlimited social media accounts',
      'Unlimited AI-generated posts',
      'Enterprise analytics suite',
      'Dedicated account manager',
      'Unlimited persona profiles',
      'Custom AI model training',
      'API access',
      'White-label solution',
      'SLA guarantee',
      'Custom integrations',
      'On-premise deployment option',
      'Advanced security features',
    ],
    notIncluded: [],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-card border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold gradient-text">Synthex</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/features" className="text-gray-300 hover:text-white transition">
                Features
              </Link>
              <Link href="/pricing" className="text-white">
                Pricing
              </Link>
              <Link href="/docs" className="text-gray-300 hover:text-white transition">
                Docs
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="text-gray-300 hover:text-white">
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="gradient-primary text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
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
                className={`glass-card p-8 relative ${
                  plan.popular ? 'border-purple-500 scale-105' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="gradient-primary text-white px-4 py-1 rounded-full text-sm font-semibold">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="mb-2">
                    <span className="text-4xl font-bold gradient-text">{plan.price}</span>
                    {plan.price !== 'Custom' && <span className="text-gray-400">/month</span>}
                  </div>
                  <p className="text-gray-400 text-sm">{plan.description}</p>
                </div>

                <div className="space-y-4 mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start space-x-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map((feature) => (
                    <div key={feature} className="flex items-start space-x-3 opacity-50">
                      <X className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-500 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <Link href="/signup" className="block">
                  <Button
                    className={`w-full ${
                      plan.popular
                        ? 'gradient-primary text-white'
                        : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
                    }`}
                    size="lg"
                  >
                    {plan.price === 'Custom' ? 'Contact Sales' : 'Start Free Trial'}
                  </Button>
                </Link>
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
              <Card key={faq.q} className="glass-card p-6">
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
          <Card className="glass-card p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Start Your 14-Day Free Trial
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              No credit card required. Cancel anytime.
            </p>
            <Link href="/signup">
              <Button size="lg" className="gradient-primary text-white px-10 py-6 text-lg">
                Get Started Now
              </Button>
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}