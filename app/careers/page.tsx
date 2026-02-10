'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Clock, DollarSign, Users,
  Heart, Rocket, Globe, Code, TrendingUp,
  ArrowRight, CheckCircle, Briefcase
} from '@/components/icons';
import { useState } from 'react';
import MarketingLayout from '@/components/marketing/MarketingLayout';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  level: string;
  description: string;
  requirements: string[];
}

const openPositions: Job[] = [
  {
    id: '1',
    title: 'Senior Full Stack Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
    description: 'Build and scale our AI-powered platform using Next.js, TypeScript, and Python.',
    requirements: ['5+ years experience', 'React/Next.js expertise', 'Python/AI experience', 'Strong system design']
  },
  {
    id: '2',
    title: 'Machine Learning Engineer',
    department: 'AI/ML',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
    description: 'Develop and optimize ML models for content generation and pattern analysis.',
    requirements: ['3+ years ML experience', 'PyTorch/TensorFlow', 'NLP expertise', 'Production ML systems']
  },
  {
    id: '3',
    title: 'Product Designer',
    department: 'Design',
    location: 'Remote',
    type: 'Full-time',
    level: 'Mid-Senior',
    description: 'Design intuitive interfaces for our AI-powered marketing platform.',
    requirements: ['4+ years product design', 'Figma expertise', 'SaaS experience', 'User research skills']
  },
  {
    id: '4',
    title: 'Customer Success Manager',
    department: 'Customer Success',
    location: 'Remote',
    type: 'Full-time',
    level: 'Mid',
    description: 'Help our customers achieve success with Synthex and drive retention.',
    requirements: ['2+ years CS experience', 'SaaS background', 'Technical aptitude', 'Excellent communication']
  },
  {
    id: '5',
    title: 'Growth Marketing Manager',
    department: 'Marketing',
    location: 'Remote',
    type: 'Full-time',
    level: 'Senior',
    description: 'Drive user acquisition and growth through data-driven marketing strategies.',
    requirements: ['5+ years growth marketing', 'B2B SaaS experience', 'Analytics expertise', 'Content marketing']
  }
];

const benefits = [
  { icon: DollarSign, title: 'Competitive Salary', description: 'Top-tier compensation with equity' },
  { icon: Heart, title: 'Health & Wellness', description: '100% covered health, dental, vision' },
  { icon: Globe, title: 'Remote First', description: 'Work from anywhere in the world' },
  { icon: Rocket, title: 'Growth Budget', description: '$2,000 annual learning budget' },
  { icon: Clock, title: 'Flexible Hours', description: 'Work when you\'re most productive' },
  { icon: Users, title: 'Team Retreats', description: 'Quarterly in-person gatherings' }
];

const culture = [
  'Ship fast and iterate based on user feedback',
  'Default to transparency in all communications',
  'Take ownership and drive initiatives forward',
  'Celebrate wins and learn from failures',
  'Put users first in every decision',
  'Foster diversity and inclusion'
];

export default function CareersPage() {
  const [selectedDepartment, setSelectedDepartment] = useState('All');

  const departments = ['All', ...new Set(openPositions.map(job => job.department))];

  const filteredJobs = selectedDepartment === 'All'
    ? openPositions
    : openPositions.filter(job => job.department === selectedDepartment);

  return (
    <MarketingLayout currentPage="careers">
      {/* Hero Section */}
      <section className="pt-12 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-6xl font-bold text-white mb-6 heading-serif">
            Join Us in Building the
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Future of AI Marketing</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            We're looking for passionate individuals who want to democratize AI-powered marketing
            and help millions of creators succeed.
          </p>
          <Button
            onClick={() => document.getElementById('positions')?.scrollIntoView({ behavior: 'smooth' })}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-8 py-3"
          >
            View Open Positions
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>
      </section>

      {/* Why Join Us */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12 heading-serif">
            Why <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Synthex?</span>
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="bg-[#0f172a]/80 border-cyan-500/10 p-6 text-center">
              <Rocket className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Massive Impact</h3>
              <p className="text-gray-400">
                Help millions of creators and businesses succeed with AI-powered tools.
              </p>
            </Card>
            <Card className="bg-[#0f172a]/80 border-cyan-500/10 p-6 text-center">
              <TrendingUp className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Rapid Growth</h3>
              <p className="text-gray-400">
                Join a fast-growing startup with 10x growth trajectory and unlimited potential.
              </p>
            </Card>
            <Card className="bg-[#0f172a]/80 border-cyan-500/10 p-6 text-center">
              <Code className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Cutting-Edge Tech</h3>
              <p className="text-gray-400">
                Work with the latest AI/ML technologies and shape the future of marketing.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12 heading-serif">
            Benefits & <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Perks</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {benefits.map((benefit, index) => (
              <Card key={index} className="bg-[#0f172a]/80 border-cyan-500/10 p-6 hover:scale-105 transition-transform">
                <benefit.icon className="w-10 h-10 text-cyan-400 mb-3" />
                <h3 className="text-lg font-semibold text-white mb-1">{benefit.title}</h3>
                <p className="text-gray-400 text-sm">{benefit.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Culture */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-[#0f172a]/80 border-cyan-500/10 p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold text-white mb-6 heading-serif">
                  Our <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Culture</span>
                </h2>
                <p className="text-gray-300 mb-6">
                  At Synthex, we believe in building a culture where everyone can do their best work,
                  grow professionally, and have fun along the way.
                </p>
                <ul className="space-y-3">
                  {culture.map((item, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/20 rounded-2xl"></div>
                <div className="relative p-8">
                  <Users className="w-full h-64 text-white/20" />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Open Positions */}
      <section id="positions" className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-4 heading-serif">
            Open <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Positions</span>
          </h2>
          <p className="text-center text-gray-300 mb-8">
            Join our team and help shape the future of AI-powered marketing
          </p>

          {/* Department Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`px-4 py-2 rounded-full transition-all ${
                  selectedDepartment === dept
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                    : 'bg-[#0f172a]/80 text-gray-300 hover:bg-[#0f172a] border border-cyan-500/10'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>

          {/* Job Listings */}
          <div className="space-y-4 max-w-4xl mx-auto">
            {filteredJobs.map((job) => (
              <Card key={job.id} className="bg-[#0f172a]/80 border-cyan-500/10 p-6 hover:shadow-xl transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-grow">
                    <h3 className="text-xl font-semibold text-white mb-2">{job.title}</h3>
                    <p className="text-gray-300 mb-3">{job.description}</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs rounded-full">
                        {job.department}
                      </span>
                      <span className="px-3 py-1 bg-cyan-500/10 text-cyan-300 text-xs rounded-full">
                        {job.location}
                      </span>
                      <span className="px-3 py-1 bg-cyan-500/10 text-cyan-300 text-xs rounded-full">
                        {job.type}
                      </span>
                      <span className="px-3 py-1 bg-cyan-500/10 text-cyan-300 text-xs rounded-full">
                        {job.level}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {job.requirements.map((req, index) => (
                        <span key={index} className="text-gray-400 text-sm">
                          {req} {index < job.requirements.length - 1 && '-'}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white whitespace-nowrap">
                    Apply Now
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-[#0f172a]/80 border-cyan-500/10 p-12 text-center">
            <Briefcase className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
            <h2 className="text-4xl font-bold text-white mb-4">
              Don't See the Right Role?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              We're always looking for exceptional talent. Send us your resume and tell us how
              you can contribute to our mission.
            </p>
            <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-8 py-3">
              Send Your Resume
            </Button>
            <p className="text-gray-400 mt-4">careers@synthex.ai</p>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
