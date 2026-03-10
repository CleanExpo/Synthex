'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import {
  TrendingUp, Users, ArrowRight,
  Quote, Star, Rocket, Award, Globe,
  Building, ShoppingCart, Briefcase
} from '@/components/icons';

const caseStudies = [
  {
    id: 1,
    company: 'TechStart Inc.',
    industry: 'SaaS / Technology',
    logo: '🚀',
    challenge: 'Struggling to maintain consistent social media presence while scaling their startup.',
    solution: 'Implemented AI persona learning to capture their unique brand voice and automated content generation.',
    results: [
      { metric: '340%', label: 'Increase in Engagement' },
      { metric: '50K', label: 'New Followers in 3 Months' },
      { metric: '12hrs', label: 'Saved Per Week' },
    ],
    quote: "Synthex transformed our social media strategy. We went from posting sporadically to having a consistent, engaging presence that actually converts.",
    author: 'Sarah Chen',
    role: 'CEO & Co-founder',
    featured: true,
  },
  {
    id: 2,
    company: 'GlowUp Beauty',
    industry: 'E-commerce / Beauty',
    logo: '✨',
    challenge: 'Needed to scale content production for multiple product launches across platforms.',
    solution: 'Used viral pattern analysis and smart scheduling to optimize posting times and content types.',
    results: [
      { metric: '425%', label: 'ROI on Social Ads' },
      { metric: '2.8M', label: 'Monthly Impressions' },
      { metric: '89%', label: 'Time Saved on Content' },
    ],
    quote: "The AI understands our brand voice perfectly. Our engagement rates have never been higher, and we're reaching audiences we never could before.",
    author: 'Marcus Johnson',
    role: 'Head of Marketing',
    featured: true,
  },
  {
    id: 3,
    company: 'FitLife Coaching',
    industry: 'Health & Fitness',
    logo: '💪',
    challenge: 'Solo entrepreneur needed to compete with larger fitness brands on social media.',
    solution: 'Leveraged AI content generation and multi-platform posting to maintain presence across 6 platforms.',
    results: [
      { metric: '100K', label: 'Followers Gained' },
      { metric: '8x', label: 'Lead Generation' },
      { metric: '$45K', label: 'Monthly Revenue Increase' },
    ],
    quote: "As a one-person business, Synthex is like having a full marketing team. I focus on coaching while it handles my entire social presence.",
    author: 'Emma Rodriguez',
    role: 'Founder & Head Coach',
    featured: false,
  },
  {
    id: 4,
    company: 'Urban Eats Restaurant Group',
    industry: 'Hospitality / Food',
    logo: '🍽️',
    challenge: 'Managing social media for 12 restaurant locations with limited marketing staff.',
    solution: 'Implemented team collaboration features with location-specific content automation.',
    results: [
      { metric: '156%', label: 'Increase in Reservations' },
      { metric: '4.8★', label: 'Average Review Rating' },
      { metric: '67%', label: 'Higher Local Reach' },
    ],
    quote: "We can now maintain unique personalities for each location while ensuring brand consistency. Our local engagement has skyrocketed.",
    author: 'David Park',
    role: 'Marketing Director',
    featured: false,
  },
  {
    id: 5,
    company: 'NextGen Agency',
    industry: 'Marketing Agency',
    logo: '📈',
    challenge: 'Agency needed to scale client management without proportionally increasing headcount.',
    solution: 'White-label solution with custom AI training for each client\'s brand voice.',
    results: [
      { metric: '3x', label: 'Client Capacity' },
      { metric: '94%', label: 'Client Retention Rate' },
      { metric: '40%', label: 'Profit Margin Increase' },
    ],
    quote: "Synthex allowed us to triple our client base without hiring additional staff. The white-label features make it seamlessly ours.",
    author: 'Alex Thompson',
    role: 'Agency Owner',
    featured: false,
  },
  {
    id: 6,
    company: 'EcoWear Fashion',
    industry: 'Sustainable Fashion',
    logo: '🌿',
    challenge: 'Needed to tell their sustainability story effectively across multiple demographics.',
    solution: 'Used A/B testing and viral pattern analysis to optimize messaging for different audience segments.',
    results: [
      { metric: '215%', label: 'Brand Awareness Growth' },
      { metric: '78K', label: 'Community Members' },
      { metric: '52%', label: 'Higher Conversion Rate' },
    ],
    quote: "The platform helps us communicate our mission authentically. Our community has grown into passionate brand advocates.",
    author: 'Lisa Green',
    role: 'Brand Director',
    featured: false,
  },
];

const stats = [
  { value: '10,000+', label: 'Active Users' },
  { value: '500M+', label: 'Posts Generated' },
  { value: '2.2x', label: 'Avg. Engagement Boost' },
  { value: '97%', label: 'Customer Satisfaction' },
];

export default function CaseStudiesPage() {
  const featuredStudies = caseStudies.filter(study => study.featured);
  const moreStudies = caseStudies.filter(study => !study.featured);

  return (
    <MarketingLayout currentPage="case-studies">
      {/* Hero Section */}
      <section className="pt-12 pb-16 px-6">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-2 mb-6">
            <Award className="w-4 h-4 text-cyan-400 mr-2" />
            <span className="text-cyan-300 text-sm">Real Results from Real Businesses</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">
            Success Stories That <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">Inspire</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto">
            See how businesses of all sizes are transforming their social media presence
            and achieving remarkable growth with Synthex.
          </p>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="pb-16 px-6">
        <div className="container mx-auto">
          <div className="bg-surface-base/80 backdrop-blur-xl border border-cyan-500/10 rounded-2xl p-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300 mb-2">{stat.value}</div>
                  <div className="text-gray-500 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Case Studies */}
      <section className="pb-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">Featured Success Stories</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Deep dives into how leading companies achieved extraordinary results
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {featuredStudies.map((study) => (
              <Card key={study.id} className="bg-surface-base/60 backdrop-blur-xl border border-cyan-500/10 p-8 relative overflow-hidden hover:border-cyan-500/30 transition-all">
                <div className="absolute top-4 right-4">
                  <span className="bg-cyan-500/20 text-cyan-300 text-xs px-3 py-1 rounded-full border border-cyan-500/30">
                    Featured
                  </span>
                </div>

                <div className="flex items-start gap-4 mb-6">
                  <div className="text-4xl">{study.logo}</div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{study.company}</h3>
                    <p className="text-cyan-400 text-sm">{study.industry}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">THE CHALLENGE</h4>
                  <p className="text-gray-500">{study.challenge}</p>
                </div>

                <div className="mb-6">
                  <h4 className="text-sm font-semibold text-gray-400 mb-2">THE SOLUTION</h4>
                  <p className="text-gray-500">{study.solution}</p>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  {study.results.map((result, idx) => (
                    <div key={idx} className="text-center bg-surface-dark/60 border border-cyan-500/10 rounded-lg p-3">
                      <div className="text-2xl font-bold text-emerald-400">{result.metric}</div>
                      <div className="text-xs text-gray-500">{result.label}</div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-cyan-500/10 pt-6">
                  <Quote className="w-8 h-8 text-cyan-500/30 mb-3" />
                  <p className="text-gray-400 italic mb-4">&quot;{study.quote}&quot;</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white font-semibold">
                      {study.author.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <div className="text-white font-medium">{study.author}</div>
                      <div className="text-gray-500 text-sm">{study.role}, {study.company}</div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* More Case Studies */}
      <section className="py-20 px-6 bg-surface-base/50 border-y border-cyan-500/10">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">More Success Stories</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Discover how businesses across industries are winning with Synthex
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {moreStudies.map((study) => (
              <Card key={study.id} className="bg-surface-base/60 backdrop-blur-xl border border-cyan-500/10 p-6 hover:border-cyan-500/30 transition-all cursor-pointer group">
                <div className="text-3xl mb-4">{study.logo}</div>
                <h3 className="text-lg font-bold text-white mb-1">{study.company}</h3>
                <p className="text-cyan-400 text-xs mb-4">{study.industry}</p>

                <div className="space-y-2 mb-4">
                  {study.results.slice(0, 2).map((result, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-gray-500 text-sm">{result.label}</span>
                      <span className="text-emerald-400 font-semibold">{result.metric}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center text-cyan-400 text-sm group-hover:text-cyan-300 transition">
                  Read full story
                  <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Breakdown */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">Trusted Across Industries</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            From startups to enterprises, Synthex powers social media success everywhere
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
            {[
              { icon: Rocket, name: 'Startups', count: '2,500+' },
              { icon: ShoppingCart, name: 'E-commerce', count: '3,200+' },
              { icon: Briefcase, name: 'Agencies', count: '850+' },
              { icon: Building, name: 'Enterprise', count: '420+' },
              { icon: Users, name: 'Creators', count: '5,100+' },
              { icon: Globe, name: 'Non-profits', count: '680+' },
            ].map((industry, index) => (
              <div key={index} className="text-center bg-surface-base/60 backdrop-blur-xl border border-cyan-500/10 rounded-xl p-4 hover:border-cyan-500/30 transition-all">
                <industry.icon className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <div className="text-white font-medium mb-1">{industry.name}</div>
                <div className="text-gray-500 text-sm">{industry.count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="py-20 px-6 bg-surface-base/50 border-y border-cyan-500/10">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">What Our Customers Say</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {caseStudies.slice(0, 3).map((study) => (
              <Card key={study.id} className="bg-surface-base/60 backdrop-blur-xl border border-cyan-500/10 p-6">
                <div className="flex gap-1 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-gray-400 mb-6 text-sm">&quot;{study.quote}&quot;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white text-sm font-semibold">
                    {study.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-white font-medium text-sm">{study.author}</div>
                    <div className="text-gray-500 text-xs">{study.company}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Write Your Success Story?
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Join thousands of businesses achieving remarkable results with AI-powered social media management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-10 py-6 text-lg shadow-lg shadow-cyan-500/25">
                  Start Free Trial
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-cyan-500/30 text-white hover:bg-cyan-500/10 px-10 py-6 text-lg">
                  View Pricing
                </Button>
              </Link>
            </div>
            <p className="text-gray-500 text-sm mt-6">
              No credit card required - 14-day free trial - Cancel anytime
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
