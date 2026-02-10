'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Target, Users, Rocket, Award,
  Heart, ArrowRight, Brain,
  Shield
} from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

const stats = [
  { value: '10,000+', label: 'Active Users' },
  { value: '50M+', label: 'Posts Generated' },
  { value: '97%', label: 'Customer Satisfaction' },
  { value: '3.5x', label: 'Average ROI' }
];

const teamMembers = [
  {
    name: 'Sarah Chen',
    role: 'CEO & Co-Founder',
    bio: 'Former Head of AI at Meta, passionate about democratizing AI for creators.',
    expertise: 'AI Strategy'
  },
  {
    name: 'Marcus Johnson',
    role: 'CTO & Co-Founder',
    bio: '15+ years in ML/AI, previously built viral prediction algorithms at TikTok.',
    expertise: 'Machine Learning'
  },
  {
    name: 'Emily Rodriguez',
    role: 'Head of Product',
    bio: 'Product leader with experience at Twitter, Instagram, and LinkedIn.',
    expertise: 'Product Design'
  },
  {
    name: 'Dr. James Miller',
    role: 'Chief AI Officer',
    bio: 'PhD in Computational Linguistics, published researcher in NLP and content generation.',
    expertise: 'Natural Language'
  }
];

const values = [
  {
    icon: Heart,
    title: 'User-Centric',
    description: 'Every feature we build starts with understanding our users\' needs and challenges.'
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description: 'Your data is yours. We prioritize security and privacy in everything we do.'
  },
  {
    icon: Rocket,
    title: 'Innovation',
    description: 'We push the boundaries of AI to deliver cutting-edge solutions that actually work.'
  },
  {
    icon: Users,
    title: 'Community',
    description: 'We believe in building together with our community of creators and marketers.'
  }
];

const milestones = [
  { year: '2023', event: 'Synthex founded with a vision to democratize AI marketing' },
  { year: '2024 Q1', event: 'Launched beta with 100 early adopters' },
  { year: '2024 Q2', event: 'Raised $5M seed funding from top VCs' },
  { year: '2024 Q3', event: 'Reached 1,000 active users' },
  { year: '2024 Q4', event: 'Launched Pro features and enterprise solutions' },
  { year: '2025', event: 'Expanded to 10,000+ users across 50 countries' }
];

export default function AboutPage() {
  return (
    <MarketingLayout currentPage="about">
      {/* Hero Section */}
      <section className="pt-12 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-6xl font-bold text-white mb-6 heading-serif">
            Empowering Creators with
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">AI-Driven Success</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-12">
            We&apos;re on a mission to democratize social media success by making advanced AI marketing tools
            accessible to creators, businesses, and agencies of all sizes.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {stats.map((stat, index) => (
              <div key={index} className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-6 text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent mb-2">{stat.value}</div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-2xl p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold text-white mb-6 heading-serif">
                  Our <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">Story</span>
                </h2>
                <p className="text-gray-300 mb-4">
                  Synthex was born from a simple observation: while AI technology has advanced tremendously,
                  most creators and small businesses still struggle to leverage it effectively for social media marketing.
                </p>
                <p className="text-gray-300 mb-4">
                  Our founders, having worked at leading tech companies, saw firsthand how powerful AI tools
                  were being used by large corporations but remained inaccessible to individual creators.
                </p>
                <p className="text-gray-300 mb-6">
                  We set out to change that. Today, Synthex empowers thousands of users to create engaging content,
                  understand their audience, and grow their social media presence using the same AI technology
                  that powers the world&apos;s largest platforms.
                </p>
                <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25">
                  Join Our Journey
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-2xl"></div>
                <div className="relative p-8">
                  <Brain className="w-full h-64 text-cyan-400/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-8">
              <Target className="w-12 h-12 text-cyan-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Our Mission</h3>
              <p className="text-gray-300">
                To democratize social media success by providing creators and businesses with AI-powered tools
                that were previously only available to large corporations, enabling everyone to build authentic,
                engaging, and successful social media presence.
              </p>
            </div>
            <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-8">
              <Rocket className="w-12 h-12 text-amber-400 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-4">Our Vision</h3>
              <p className="text-gray-300">
                A world where every creator, regardless of their size or resources, can compete on equal footing
                in the digital landscape, using AI to amplify their unique voice and connect with their audience
                in meaningful ways.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12 heading-serif">
            Our <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Values</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div key={index} className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-6 text-center hover:scale-105 hover:border-cyan-500/30 transition-all duration-300">
                <value.icon className="w-10 h-10 text-cyan-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">{value.title}</h3>
                <p className="text-gray-400 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-4 heading-serif">
            Meet the <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">Team</span>
          </h2>
          <p className="text-center text-gray-300 mb-12 max-w-2xl mx-auto">
            We&apos;re a diverse team of AI researchers, product designers, and marketing experts united by
            our passion for empowering creators.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {teamMembers.map((member, index) => (
              <div key={index} className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-6 hover:transform hover:scale-105 hover:border-cyan-500/30 transition-all duration-300">
                <div className="w-20 h-20 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Users className="w-10 h-10 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white text-center mb-1">{member.name}</h3>
                <p className="text-cyan-400 text-center text-sm mb-3">{member.role}</p>
                <p className="text-gray-400 text-sm text-center mb-3">{member.bio}</p>
                <div className="text-center">
                  <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full border border-cyan-500/20">
                    {member.expertise}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12 heading-serif">
            Our <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Journey</span>
          </h2>
          <div className="max-w-4xl mx-auto">
            {milestones.map((milestone, index) => (
              <div key={index} className="flex gap-4 mb-8">
                <div className="flex-shrink-0">
                  <div className="w-4 h-4 bg-cyan-500 rounded-full mt-1 shadow-lg shadow-cyan-500/50"></div>
                  {index < milestones.length - 1 && (
                    <div className="w-0.5 h-20 bg-gradient-to-b from-cyan-500 to-cyan-500/30 ml-1.5 mt-1"></div>
                  )}
                </div>
                <div className="flex-grow">
                  <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm p-4 rounded-lg hover:border-cyan-500/30 transition-colors">
                    <div className="text-cyan-400 font-semibold mb-1">{milestone.year}</div>
                    <div className="text-gray-300">{milestone.event}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="bg-gradient-to-r from-[#0d1f35] to-[#0a1628] border border-cyan-500/20 backdrop-blur-sm rounded-2xl p-12 text-center relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-cyan-400/10 to-cyan-500/5 pointer-events-none" />

            <div className="relative z-10">
              <h2 className="text-4xl font-bold text-white mb-4">
                Ready to Join the <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">AI Revolution?</span>
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Be part of the movement that&apos;s democratizing social media success with AI.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Link href="/signup">
                  <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-8 py-3 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all">
                    Start Free Trial
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/careers">
                  <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 px-8 py-3 transition-all">
                    Join Our Team
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
