'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Heart,
  Eye,
  Cpu,
  TrendingUp,
  Users,
  ArrowRight,
  Target,
  Rocket,
  Brain,
} from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import GlowCard from '@/components/landing/glow-card';

const stats = [
  { value: '10,000+', label: 'Active users across 50+ countries' },
  { value: '50M+', label: 'Posts generated to date' },
  { value: '97%', label: 'Customer satisfaction score' },
  { value: '3.5×', label: 'Average ROI for our users' },
];

const teamMembers = [
  {
    name: 'Alex Nguyen',
    role: 'CEO & Co-Founder',
    bio: 'Previously led growth at two SaaS companies that exited. 10 years in B2B marketing.',
    quote:
      "We built the tool I wish I'd had when I was managing 6 clients at once.",
    initials: 'AN',
  },
  {
    name: 'Jordan Kim',
    role: 'CTO & Co-Founder',
    bio: 'Ex-ML engineer, specialised in NLP and content recommendation systems. Masters in Computer Science.',
    quote:
      "The hard part wasn't making AI write — it was making it write like you.",
    initials: 'JK',
  },
  {
    name: 'Sam Okafor',
    role: 'Head of Product',
    bio: '8 years in product, previously at social media analytics companies.',
    quote: "If it takes more than 3 clicks, we haven't done our job.",
    initials: 'SO',
  },
  {
    name: 'Riley Walsh',
    role: 'Head of Customer Success',
    bio: 'Background in agency account management; joined to build the support experience she always wanted as a client.',
    quote: "Our users' wins are the only metric that matters.",
    initials: 'RW',
  },
];

const values = [
  {
    icon: Heart,
    title: 'Creator-First',
    description:
      "Every feature we build starts with one question: does this make a creator's life genuinely better? Not marginally better — actually better.",
  },
  {
    icon: Eye,
    title: 'Radical Transparency',
    description:
      'No dark patterns. No hidden limits. No confusing pricing. We want you to trust us with your brand — that starts with being straight with you.',
  },
  {
    icon: Cpu,
    title: 'AI With Purpose',
    description:
      'We use AI as a tool, not a shortcut. Our models are trained to amplify your voice, not replace it. Your audience follows you — we make sure the AI knows that.',
  },
  {
    icon: TrendingUp,
    title: 'Built to Scale',
    description:
      "Whether you're a solo creator or an agency with 200 clients, Synthex grows with you. No artificial limits, no degraded experience at volume.",
  },
];

const milestones = [
  {
    period: 'Q3 2023',
    event: 'Founded in Sydney, Australia. First prototype built in 6 weeks.',
  },
  {
    period: 'Q4 2023',
    event: 'Closed pre-seed round. Onboarded first 50 beta users.',
  },
  { period: 'Q2 2024', event: 'Public launch. 1,000 users in first 30 days.' },
  {
    period: 'Q3 2024',
    event: 'Raised seed funding. Launched Pro and Agency plans.',
  },
  {
    period: 'Q1 2025',
    event: 'Reached 10,000 active users across 50+ countries.',
  },
  {
    period: 'Q2 2025',
    event:
      'Launched Agency white-label and API access. Expanded to 9 platforms.',
  },
];

export default function AboutPage() {
  return (
    <MarketingLayout currentPage="about">
      {/* Hero Section */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-4">
            About Synthex
          </p>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 heading-serif">
            Built for Creators.{' '}
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
              Powered by AI.
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-16">
            We started Synthex because we were tired of spending more time
            writing captions than building businesses. Now 10,000+ creators use
            it every day.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <GlowCard key={index} className="p-6 text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent mb-2">
                  {stat.value}
                </div>
                <div className="text-gray-400 text-sm">{stat.label}</div>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-2xl p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-4">
                  Our Story
                </p>
                <h2 className="text-4xl font-bold text-white mb-6 heading-serif">
                  Where It All{' '}
                  <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                    Started
                  </span>
                </h2>
                <p className="text-gray-300 mb-5">
                  We built Synthex out of frustration. Our founding team had
                  worked in digital marketing for years, and the same problem
                  kept coming up: content creation was eating every hour of the
                  day. Agencies were billing clients for work that should take
                  minutes. Solo creators were burning out writing the same
                  captions over and over. Something had to change.
                </p>
                <p className="text-gray-300 mb-5">
                  The breakthrough came when we realised that great social media
                  content isn&apos;t random — it follows patterns. Every
                  successful creator has a distinct voice, a style their
                  audience recognises, and a sense of timing. The question was:
                  could AI learn that? After 18 months of research and testing,
                  the answer was yes. Better than yes — it could learn it from
                  your own best work.
                </p>
                <p className="text-gray-300 mb-6">
                  Today, Synthex processes millions of posts every month for
                  creators and brands across 50+ countries. Our AI doesn&apos;t
                  replace human creativity — it amplifies it. The strategy is
                  still yours. The ideas are still yours. Synthex just removes
                  the part that drains you: the repetitive execution.
                </p>
                <p className="text-gray-400 text-sm mb-6">
                  Synthex is a{' '}
                  <a
                    href="https://unite-group.com.au"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    Unite-Group
                  </a>{' '}
                  product — AI-powered marketing automation for modern
                  businesses.
                </p>
                <Link href="/signup">
                  <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25">
                    Start for Free
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-2xl" />
                <div className="relative p-8">
                  <Brain className="w-full h-64 text-cyan-400/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-4">
              Why We Exist
            </p>
            <h2 className="text-4xl font-bold text-white heading-serif">
              Mission &amp;{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                Vision
              </span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-8">
              <Target className="w-12 h-12 text-cyan-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">
                Our Mission
              </h3>
              <p className="text-gray-300">
                To give every creator and business access to the kind of content
                strategy that used to require a full marketing team — and make
                it feel effortless.
              </p>
            </div>
            <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-8">
              <Rocket className="w-12 h-12 text-cyan-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
              <p className="text-gray-300">
                A world where the quality of your content is limited only by
                your ideas, not your resources, team size, or budget.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-4">
              What We Stand For
            </p>
            <h2 className="text-4xl font-bold text-white heading-serif">
              Our{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                Values
              </span>
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-6 text-center hover:scale-105 hover:border-cyan-500/30 transition-all duration-300"
              >
                <value.icon className="w-10 h-10 text-cyan-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">
                  {value.title}
                </h3>
                <p className="text-gray-400 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-4">
              The People Behind It
            </p>
            <h2 className="text-4xl font-bold text-white mb-4 heading-serif">
              Meet the{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                Team
              </span>
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto">
              A small team that moves fast and takes craft seriously. Based in
              Sydney, building for the world.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member, index) => (
              <GlowCard key={index} className="p-6 flex flex-col">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 border border-cyan-500/20 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-cyan-400 font-bold text-lg tracking-wide">
                    {member.initials}
                  </span>
                </div>
                <h3 className="text-xl font-semibold text-white text-center mb-1">
                  {member.name}
                </h3>
                <p className="text-cyan-400 text-center text-sm mb-4">
                  {member.role}
                </p>
                <p className="text-gray-400 text-sm text-center mb-5 flex-grow">
                  {member.bio}
                </p>
                <blockquote className="text-gray-300 text-sm text-center italic border-t border-cyan-500/10 pt-4">
                  &ldquo;{member.quote}&rdquo;
                </blockquote>
              </GlowCard>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-4">
              How We Got Here
            </p>
            <h2 className="text-4xl font-bold text-white heading-serif">
              Our{' '}
              <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                Journey
              </span>
            </h2>
          </div>
          <div className="max-w-4xl mx-auto">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex gap-4 mb-8">
                <div className="flex-shrink-0">
                  <div className="w-4 h-4 bg-cyan-500 rounded-full mt-1 shadow-lg shadow-cyan-500/50" />
                  {index < milestones.length - 1 && (
                    <div className="w-0.5 h-20 bg-gradient-to-b from-cyan-500 to-cyan-500/30 ml-1.5 mt-1" />
                  )}
                </div>
                <div className="flex-grow">
                  <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm p-4 rounded-lg hover:border-cyan-500/30 transition-colors">
                    <div className="text-cyan-400 font-semibold mb-1">
                      {milestone.period}
                    </div>
                    <div className="text-gray-300">{milestone.event}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-28 px-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-[#0d1f35] to-[#0a1628] border border-cyan-500/20 backdrop-blur-sm rounded-2xl p-12 text-center relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-cyan-400/10 to-cyan-500/5 pointer-events-none" />
            <div className="relative z-10">
              <p className="text-cyan-400 text-sm font-semibold uppercase tracking-wider mb-4">
                We&apos;re Hiring
              </p>
              <h2 className="text-4xl font-bold text-white mb-4 heading-serif">
                Want to{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                  Join the Team?
                </span>
              </h2>
              <p className="text-xl text-gray-300 mb-10 max-w-2xl mx-auto">
                We&apos;re a small team that moves fast and takes craft
                seriously. If that sounds like you, we&apos;d love to hear from
                you.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Link href="/contact?subject=careers">
                  <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-8 py-3 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all">
                    View Open Roles
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button
                    variant="outline"
                    className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 px-8 py-3 transition-all"
                  >
                    Or start a free trial
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
