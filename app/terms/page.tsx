'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Scale, AlertCircle, CheckCircle, XCircle, Shield, DollarSign } from '@/components/icons';

const sections = [
  {
    title: 'Acceptable Use',
    icon: CheckCircle,
    items: [
      'Use Synthex for lawful business and personal purposes',
      'Create original content that respects intellectual property',
      'Maintain accurate account information',
      'Respect rate limits and API usage guidelines',
      'Follow social media platform terms of service'
    ]
  },
  {
    title: 'Prohibited Activities',
    icon: XCircle,
    items: [
      'Spreading misinformation or harmful content',
      'Violating intellectual property rights',
      'Attempting to reverse-engineer our AI models',
      'Using the service for spam or harassment',
      'Sharing account credentials or reselling access'
    ]
  },
  {
    title: 'Your Rights',
    icon: Shield,
    items: [
      'Full ownership of content you create',
      'Access to your data and analytics',
      'Cancel subscription at any time',
      'Request support and assistance',
      'Fair use of all included features'
    ]
  },
  {
    title: 'Our Commitments',
    icon: Scale,
    items: [
      '99.9% uptime SLA for Pro and Enterprise plans',
      'Regular feature updates and improvements',
      'Responsive customer support',
      'Data security and privacy protection',
      'Transparent pricing with no hidden fees'
    ]
  }
];

export default function TermsPage() {
  return (
    <MarketingLayout currentPage="terms">
      {/* Hero Section */}
      <section className="pt-12 pb-12 px-6">
        <div className="container mx-auto text-center">
          <FileText className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
          <h1 className="text-5xl font-bold text-white mb-4">
            Terms of <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">Service</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Clear, fair terms that protect both you and Synthex while fostering innovation and growth.
          </p>
          <p className="text-gray-500 mt-4">Effective Date: January 11, 2025</p>
        </div>
      </section>

      {/* Agreement Overview */}
      <section className="px-6 pb-12">
        <div className="container mx-auto">
          <Card className="bg-[#0f172a]/80 border border-cyan-500/20 backdrop-blur-sm p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Agreement Overview</h2>
            <p className="text-gray-300 mb-4">
              By using Synthex, you agree to these terms. We've written them to be clear and fair,
              protecting both your interests and ours while enabling you to grow your social media presence with AI.
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-gray-300 text-sm">
                  <strong className="text-amber-400">Important:</strong> These terms constitute a legal agreement.
                  If you disagree with any part, please don't use our service. Contact us at legal@synthex.ai
                  if you have questions.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Main Sections */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {sections.map((section, index) => (
              <Card key={index} className="bg-[#0f172a]/80 border border-cyan-500/20 backdrop-blur-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <section.icon className="w-8 h-8 text-cyan-400" />
                  <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                </div>
                <ul className="space-y-2">
                  {section.items.map((item, idx) => (
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

      {/* Detailed Terms */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-[#0f172a]/80 border border-cyan-500/20 backdrop-blur-sm p-8 max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-white mb-6">Service Terms</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">1. Account Registration</h3>
                <p className="text-gray-300">
                  You must provide accurate information when creating an account. You're responsible for maintaining
                  the security of your account credentials. Notify us immediately of any unauthorized access.
                  Accounts are for individual or company use only - sharing credentials is prohibited.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">2. Subscription and Billing</h3>
                <p className="text-gray-300">
                  Subscriptions auto-renew unless cancelled. You can cancel anytime, with changes taking effect at the
                  end of your billing period. Refunds are available within 14 days of purchase if you're unsatisfied.
                  Prices may change with 30 days notice for existing customers.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">3. Content and Intellectual Property</h3>
                <p className="text-gray-300">
                  You retain ownership of all content you create. You grant Synthex a license to process your content
                  for service provision only. Our AI models and technology remain our intellectual property.
                  You must respect third-party intellectual property rights in all content you create.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">4. Service Availability</h3>
                <p className="text-gray-300">
                  We strive for 99.9% uptime but don't guarantee uninterrupted service. Scheduled maintenance will be
                  announced in advance. We're not liable for third-party platform outages (social media APIs).
                  Force majeure events may affect service availability.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">5. Limitation of Liability</h3>
                <p className="text-gray-300">
                  Our liability is limited to the amount you've paid in the last 12 months. We're not responsible for
                  indirect, incidental, or consequential damages. This includes lost profits, data loss, or business interruption.
                  Some jurisdictions don't allow these limitations.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">6. Termination</h3>
                <p className="text-gray-300">
                  Either party can terminate with notice. We may suspend accounts for terms violations.
                  Upon termination, you can export your data for 30 days. After termination, we'll delete your data per our privacy policy.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">7. Dispute Resolution</h3>
                <p className="text-gray-300">
                  We prefer to resolve disputes through good-faith negotiation. If needed, disputes will be resolved through
                  binding arbitration in San Francisco, CA. Class action waiver applies where permitted by law.
                  Small claims court remains available for qualifying disputes.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-2">8. Modifications</h3>
                <p className="text-gray-300">
                  We may update these terms with 30 days notice for material changes. Continued use after changes constitutes acceptance.
                  We'll notify you via email and in-app notifications. You can always access the current version in your account settings.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* SLA for Pro/Enterprise */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-[#0f172a]/80 border border-cyan-500/20 backdrop-blur-sm p-8 max-w-4xl mx-auto">
            <DollarSign className="w-10 h-10 text-amber-400 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-6">Service Level Agreement (Pro & Enterprise)</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-3">Uptime Guarantee</h3>
                <ul className="space-y-2 text-gray-300">
                  <li>• 99.9% uptime commitment</li>
                  <li>• Service credits for downtime</li>
                  <li>• 24/7 system monitoring</li>
                  <li>• Priority support queue</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-cyan-400 mb-3">Support Response Times</h3>
                <ul className="space-y-2 text-gray-300">
                  <li>• Critical issues: 1 hour</li>
                  <li>• High priority: 4 hours</li>
                  <li>• Normal priority: 24 hours</li>
                  <li>• Feature requests: 72 hours</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-cyan-500/30 p-12 text-center max-w-3xl mx-auto">
            <Scale className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Questions About Our Terms?
            </h2>
            <p className="text-gray-300 mb-6">
              Our legal team is here to clarify any questions about our terms of service.
            </p>
            <div className="space-y-2 text-gray-400">
              <p>Email: legal@synthex.social</p>
              <p>Support: support@synthex.social</p>
              <p>Address: 100 Market St, San Francisco, CA 94105</p>
            </div>
            <Button className="mt-6 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25">
              Contact Legal Team
            </Button>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
