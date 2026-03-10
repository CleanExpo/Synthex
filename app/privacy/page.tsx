'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Lock, Eye, Database, Mail, CheckCircle } from '@/components/icons';

const sections = [
  {
    title: 'Information We Collect',
    icon: Database,
    content: [
      'Account information (name, email, company)',
      'Social media account connections (OAuth tokens)',
      'Content you create and upload',
      'Usage data and analytics',
      'Payment information (processed securely via Stripe)'
    ]
  },
  {
    title: 'How We Use Your Information',
    icon: Eye,
    content: [
      'Provide and improve our AI-powered services',
      'Generate personalized content in your brand voice',
      'Analyze social media patterns and trends',
      'Send important service updates',
      'Process payments and prevent fraud'
    ]
  },
  {
    title: 'Data Security',
    icon: Lock,
    content: [
      'Enterprise-grade encryption (AES-256)',
      'SOC 2 Type II compliance',
      'Regular security audits and penetration testing',
      'Secure data centers with 24/7 monitoring',
      'Strict access controls and authentication'
    ]
  },
  {
    title: 'Your Rights',
    icon: Shield,
    content: [
      'Access your personal data anytime',
      'Request data correction or deletion',
      'Export your data in standard formats',
      'Opt-out of marketing communications',
      'Control third-party data sharing'
    ]
  }
];

export default function PrivacyPage() {
  return (
    <MarketingLayout currentPage="privacy">
      {/* Hero Section */}
      <section className="pt-12 pb-12 px-6">
        <div className="container mx-auto text-center">
          <Shield className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
          <h1 className="text-5xl font-bold text-white mb-4">
            Privacy <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">Policy</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Your privacy is fundamental to our mission. We're committed to protecting your data
            and being transparent about how we use it.
          </p>
          <p className="text-gray-500 mt-4">Last updated: January 11, 2025</p>
        </div>
      </section>

      {/* Key Points */}
      <section className="px-6 pb-12">
        <div className="container mx-auto">
          <Card className="bg-surface-base/80 border border-cyan-500/20 backdrop-blur-sm p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Key Privacy Commitments</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">We never sell your personal data to third parties</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">Your content remains yours - we don't claim ownership</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">You can delete your account and data at any time</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">We use industry-standard encryption for all data</span>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-300">We're GDPR and CCPA compliant</span>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Detailed Sections */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {sections.map((section, index) => (
              <Card key={index} className="bg-surface-base/80 border border-cyan-500/20 backdrop-blur-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <section.icon className="w-8 h-8 text-cyan-400" />
                  <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                </div>
                <ul className="space-y-2">
                  {section.content.map((item, idx) => (
                    <li key={idx} className="text-gray-300 flex items-start gap-2">
                      <span className="text-cyan-400 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Additional Information */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-surface-base/80 border border-cyan-500/20 backdrop-blur-sm p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Additional Information</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">Cookies and Tracking</h3>
                <p className="text-gray-300">
                  We use essential cookies to maintain your session and preferences. Analytics cookies help us
                  understand how you use Synthex to improve our service. You can control cookie preferences in your browser settings.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">Third-Party Services</h3>
                <p className="text-gray-300">
                  We integrate with social media platforms via their official APIs. We use Stripe for payment processing,
                  AWS for hosting, and analytics tools to improve our service. All third-party services are carefully vetted
                  for security and privacy compliance.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">Data Retention</h3>
                <p className="text-gray-300">
                  We retain your data for as long as your account is active. After account deletion, we maintain certain
                  records for legal compliance (typically 90 days) before permanent deletion. You can request immediate
                  deletion of specific data at any time.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">Children's Privacy</h3>
                <p className="text-gray-300">
                  Synthex is not intended for users under 18 years of age. We do not knowingly collect personal information
                  from children. If you believe we have collected data from a minor, please contact us immediately.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">International Data Transfers</h3>
                <p className="text-gray-300">
                  Your data may be processed in countries other than your own. We ensure all international transfers comply
                  with applicable laws and maintain appropriate safeguards, including Standard Contractual Clauses where required.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-cyan-500/30 p-12 text-center max-w-3xl mx-auto">
            <Mail className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Questions About Privacy?
            </h2>
            <p className="text-gray-300 mb-6">
              Our Data Protection Officer is here to help with any privacy concerns or requests.
            </p>
            <div className="space-y-2 text-gray-400">
              <p>Email: privacy@synthex.social</p>
              <p>Data Protection Officer: legal@synthex.social</p>
              <p>Support: support@synthex.social</p>
              <p>Address: 100 Market St, San Francisco, CA 94105</p>
            </div>
            <Button className="mt-6 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25">
              Contact Privacy Team
            </Button>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
