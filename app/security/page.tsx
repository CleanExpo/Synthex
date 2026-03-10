'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Shield, Lock, Key, CheckCircle,
  Globe, Database, Eye, Users,
  ArrowRight, Server, CheckCircle2,
  Mail, Award
} from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

const securityHighlights = [
  { value: 'SOC 2 Type II', label: 'Certified' },
  { value: '256-bit', label: 'Encryption' },
  { value: '99.99%', label: 'Uptime SLA' },
  { value: 'GDPR', label: 'Compliant' }
];

const securityFeatures = [
  {
    icon: Lock,
    title: 'End-to-End Encryption',
    description: 'All data is encrypted in transit (TLS 1.3) and at rest (AES-256) to ensure your content and credentials remain secure.'
  },
  {
    icon: Shield,
    title: 'SOC 2 Type II Compliance',
    description: 'Our infrastructure and processes undergo regular third-party audits to meet the highest security standards.'
  },
  {
    icon: CheckCircle,
    title: 'GDPR & Privacy Compliant',
    description: 'Full compliance with GDPR, CCPA, and international data protection regulations. Your data, your rights.'
  },
  {
    icon: Server,
    title: '99.99% Uptime Guarantee',
    description: 'Enterprise-grade infrastructure with redundancy, failover, and 24/7 monitoring to keep your marketing running.'
  }
];

const dataProtectionPrinciples = [
  {
    title: 'Data Minimization',
    description: 'We only collect data necessary to provide our services. No unnecessary tracking or profiling.',
    icon: Database
  },
  {
    title: 'User Control',
    description: 'You own your data. Export, delete, or modify your information at any time through your account settings.',
    icon: Users
  },
  {
    title: 'Transparent Processing',
    description: 'Clear documentation of how we process, store, and use your data. No hidden practices.',
    icon: Eye
  },
  {
    title: 'Secure Storage',
    description: 'Data stored in SOC 2 certified data centers with encrypted backups and strict access controls.',
    icon: Lock
  }
];

const infrastructureDetails = [
  {
    component: 'Hosting Platform',
    provider: 'Vercel (AWS)',
    security: 'SOC 2, ISO 27001, PCI DSS',
    icon: Globe
  },
  {
    component: 'Database',
    provider: 'PostgreSQL (Supabase)',
    security: 'Encrypted at rest, regular backups',
    icon: Database
  },
  {
    component: 'Authentication',
    provider: 'JWT + OAuth 2.0',
    security: 'bcrypt hashing, secure tokens',
    icon: Key
  },
  {
    component: 'AI Processing',
    provider: 'OpenRouter API',
    security: 'Encrypted API calls, no data retention',
    icon: Server
  }
];

const authenticationFeatures = [
  'JWT tokens with secure httpOnly cookies',
  'OAuth 2.0 support (Google, GitHub, LinkedIn)',
  'Role-based access control (RBAC)',
  'Multi-factor authentication (MFA) available',
  'Comprehensive audit logging for all actions',
  'Automatic session expiration and renewal',
  'IP-based anomaly detection',
  'Rate limiting and brute-force protection'
];

const certifications = [
  {
    name: 'SOC 2 Type II',
    description: 'Service Organization Control',
    status: 'Certified',
    icon: Award
  },
  {
    name: 'GDPR',
    description: 'General Data Protection Regulation',
    status: 'Compliant',
    icon: Shield
  },
  {
    name: 'CCPA',
    description: 'California Consumer Privacy Act',
    status: 'Compliant',
    icon: CheckCircle2
  },
  {
    name: 'ISO 27001',
    description: 'Information Security Management',
    status: 'In Progress',
    icon: Award
  }
];

export default function SecurityPage() {
  return (
    <MarketingLayout currentPage="security">
      {/* Hero Section */}
      <section className="pt-12 pb-20 px-6">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-cyan-500/10 rounded-full mb-6">
            <Shield className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-6 heading-serif">
            Security at
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">SYNTHEX</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-12">
            Your data protection is our top priority. We implement enterprise-grade security measures
            to ensure your content, credentials, and business information remain safe.
          </p>

          {/* Security Highlights */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {securityHighlights.map((stat, index) => (
              <div key={index} className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-6 text-center">
                <div className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent mb-2">{stat.value}</div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12 heading-serif">
            Enterprise-Grade <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Security</span>
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {securityFeatures.map((feature, index) => (
              <div key={index} className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-8 hover:scale-105 hover:border-cyan-500/30 transition-all duration-300">
                <feature.icon className="w-12 h-12 text-cyan-400 mb-4" />
                <h3 className="text-2xl font-semibold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Data Protection */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-2xl p-12">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4 heading-serif">
                Data <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">Protection</span>
              </h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                We follow privacy-by-design principles to ensure your data is protected at every stage
                of collection, processing, and storage.
              </p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {dataProtectionPrinciples.map((principle, index) => (
                <div key={index} className="bg-surface-dark/60 border border-cyan-500/10 rounded-xl p-6 text-center">
                  <principle.icon className="w-10 h-10 text-cyan-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">{principle.title}</h3>
                  <p className="text-gray-400 text-sm">{principle.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-4 heading-serif">
            Secure <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Infrastructure</span>
          </h2>
          <p className="text-center text-gray-300 mb-12 max-w-2xl mx-auto">
            Built on industry-leading platforms with multiple layers of security and redundancy.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            {infrastructureDetails.map((detail, index) => (
              <div key={index} className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-6 hover:border-cyan-500/30 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-cyan-500/10 rounded-lg flex items-center justify-center">
                      <detail.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                  </div>
                  <div className="flex-grow">
                    <h3 className="text-xl font-semibold text-white mb-1">{detail.component}</h3>
                    <p className="text-cyan-400 mb-2">{detail.provider}</p>
                    <p className="text-gray-400 text-sm">{detail.security}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Authentication & Access Control */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-2xl p-12">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-4xl font-bold text-white mb-6 heading-serif">
                  Authentication &
                  <br />
                  <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Access Control</span>
                </h2>
                <p className="text-gray-300 mb-6">
                  Multi-layered authentication system designed to protect your account from
                  unauthorized access while maintaining seamless user experience.
                </p>
                <div className="space-y-3">
                  {authenticationFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-2xl"></div>
                <div className="relative p-8">
                  <Key className="w-full h-64 text-cyan-400/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Compliance & Certifications */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <h2 className="text-4xl font-bold text-center text-white mb-12 heading-serif">
            Compliance & <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">Certifications</span>
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {certifications.map((cert, index) => (
              <div key={index} className="bg-[#0d1f35]/80 border border-cyan-500/10 backdrop-blur-sm rounded-xl p-6 text-center hover:transform hover:scale-105 hover:border-cyan-500/30 transition-all duration-300">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/20 to-cyan-400/10 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <cert.icon className="w-8 h-8 text-cyan-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-1">{cert.name}</h3>
                <p className="text-gray-400 text-sm mb-3">{cert.description}</p>
                <span className={`inline-block px-3 py-1 text-xs rounded-full border ${
                  cert.status === 'Certified' || cert.status === 'Compliant'
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/20'
                    : 'bg-amber-500/20 text-amber-400 border-amber-500/20'
                }`}>
                  {cert.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Responsible Disclosure */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="bg-gradient-to-r from-[#0d1f35] to-[#0a1628] border border-amber-500/20 backdrop-blur-sm rounded-2xl p-12 relative overflow-hidden">
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-amber-400/10 to-amber-500/5 pointer-events-none" />

            <div className="relative z-10">
              <div className="flex items-center justify-center mb-6">
                <Mail className="w-12 h-12 text-amber-400" />
              </div>
              <h2 className="text-4xl font-bold text-white mb-4 text-center">
                Responsible <span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">Disclosure</span>
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto text-center">
                We value the security research community. If you discover a security vulnerability,
                please report it responsibly to help us protect our users.
              </p>
              <div className="bg-surface-dark/60 border border-amber-500/20 rounded-xl p-8 max-w-2xl mx-auto">
                <h3 className="text-xl font-semibold text-white mb-4">Report Security Issues</h3>
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <a href="mailto:security@synthex.social" className="text-cyan-400 hover:text-cyan-300 transition-colors">
                      security@synthex.social
                    </a>
                  </div>
                  <p className="text-gray-400 text-sm ml-8">
                    Please include detailed steps to reproduce the vulnerability. We aim to respond within 48 hours.
                  </p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <p className="text-amber-300 text-sm">
                    <strong>Bug Bounty Program:</strong> We offer rewards for qualifying security disclosures.
                    Payments range from $100 to $5,000 depending on severity and impact.
                  </p>
                </div>
              </div>
            </div>
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
                Ready to Experience <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Secure AI Marketing?</span>
              </h2>
              <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
                Join thousands of users who trust SYNTHEX to keep their marketing data safe and secure.
              </p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Link href="/signup">
                  <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-8 py-3 shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all">
                    Start Free Trial
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 hover:border-cyan-400 px-8 py-3 transition-all">
                    Contact Security Team
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
