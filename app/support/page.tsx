'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, MessageCircle, Book, Video, Mail, Phone, 
  Clock, Search, ChevronRight, HelpCircle, FileText,
  Users, Zap, Settings, Shield, CreditCard, BarChart3
} from '@/components/icons';
import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FAQItem[] = [
  {
    question: 'How does Synthex AI learn my brand voice?',
    answer: 'Synthex analyzes your existing content, including posts, captions, and responses. Our AI identifies patterns in your tone, vocabulary, and style to create a unique brand persona that maintains consistency across all generated content.',
    category: 'AI & Features'
  },
  {
    question: 'Which social media platforms does Synthex support?',
    answer: 'Synthex currently supports Twitter/X, LinkedIn, Instagram, TikTok, Facebook, YouTube, and Pinterest. We continuously add new platforms based on user demand.',
    category: 'Platforms'
  },
  {
    question: 'Can I edit AI-generated content before posting?',
    answer: 'Absolutely! All AI-generated content goes through a review stage where you can edit, refine, or regenerate content. You have full control over what gets published.',
    category: 'Content'
  },
  {
    question: 'How does the viral pattern analysis work?',
    answer: 'Our AI analyzes millions of posts daily to identify engagement patterns, trending topics, and viral triggers specific to your industry and audience. It then applies these insights to optimize your content.',
    category: 'AI & Features'
  },
  {
    question: 'What happens if I exceed my monthly post limit?',
    answer: 'You can either upgrade to a higher plan or purchase additional posts as needed. We\'ll notify you when you\'re approaching your limit.',
    category: 'Billing'
  },
  {
    question: 'Is my data secure with Synthex?',
    answer: 'Yes, we use enterprise-grade encryption for all data. Your content and analytics are stored securely and never shared with third parties. We\'re SOC 2 compliant.',
    category: 'Security'
  },
  {
    question: 'Can I collaborate with my team on Synthex?',
    answer: 'Yes! Our Pro and Enterprise plans include team collaboration features with role-based permissions, approval workflows, and shared content libraries.',
    category: 'Team'
  },
  {
    question: 'How do I connect my social media accounts?',
    answer: 'Navigate to Settings > Connected Accounts and follow the OAuth authentication process for each platform. The connection is secure and can be revoked anytime.',
    category: 'Setup'
  }
];

const categories = ['All', 'AI & Features', 'Platforms', 'Content', 'Billing', 'Security', 'Team', 'Setup'];

export default function SupportPage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = selectedCategory === 'All' || faq.category === selectedCategory;
    const matchesSearch = searchTerm === '' || 
      faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-cyan-900/20 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/[0.02] backdrop-blur-xl border-b border-white/[0.08]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-cyan-400" />
              <span className="text-2xl font-bold gradient-text-cyan">Synthex</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-12 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-4 heading-serif">
            How Can We <span className="gradient-text-cyan">Help You?</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Get instant answers, explore our documentation, or reach out to our support team
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search for help..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-6 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400/50"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions */}
      <section className="px-6 pb-12">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-4">
            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <Book className="w-8 h-8 text-cyan-400 mb-3" />
              <h3 className="text-white font-semibold mb-1">Documentation</h3>
              <p className="text-gray-400 text-sm">Comprehensive guides and tutorials</p>
            </Card>
            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <Video className="w-8 h-8 text-amber-400 mb-3" />
              <h3 className="text-white font-semibold mb-1">Video Tutorials</h3>
              <p className="text-gray-400 text-sm">Step-by-step video walkthroughs</p>
            </Card>
            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <MessageCircle className="w-8 h-8 text-purple-400 mb-3" />
              <h3 className="text-white font-semibold mb-1">Live Chat</h3>
              <p className="text-gray-400 text-sm">Chat with our support team</p>
            </Card>
            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <Mail className="w-8 h-8 text-green-400 mb-3" />
              <h3 className="text-white font-semibold mb-1">Email Support</h3>
              <p className="text-gray-400 text-sm">support@synthex.social</p>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-6 pb-12">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Frequently Asked Questions
          </h2>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full transition-all ${
                  selectedCategory === category
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* FAQ Items */}
          <div className="max-w-3xl mx-auto space-y-4">
            {filteredFAQs.map((faq, index) => (
              <Card
                key={index}
                variant="glass"
                className="overflow-hidden"
              >
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-white font-medium">{faq.question}</span>
                  <ChevronRight 
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedFAQ === index ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {expandedFAQ === index && (
                  <div className="px-6 py-4 border-t border-white/10">
                    <p className="text-gray-300">{faq.answer}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Help Center Grid */}
      <section className="px-6 pb-12">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Browse Help Topics
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card variant="glass" className="p-6">
              <Zap className="w-10 h-10 text-cyan-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Getting Started</h3>
              <ul className="space-y-2">
                <li><Link href="/onboarding" className="text-gray-400 hover:text-cyan-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> Account setup guide
                </Link></li>
                <li><Link href="/dashboard/integrations" className="text-gray-400 hover:text-cyan-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> Connect social accounts
                </Link></li>
                <li><Link href="/dashboard/content" className="text-gray-400 hover:text-cyan-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> Create your first campaign
                </Link></li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6">
              <Settings className="w-10 h-10 text-amber-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Features & Tools</h3>
              <ul className="space-y-2">
                <li><Link href="/dashboard/content" className="text-gray-400 hover:text-amber-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> AI content generation
                </Link></li>
                <li><Link href="/dashboard/analytics" className="text-gray-400 hover:text-amber-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> Analytics dashboard
                </Link></li>
                <li><Link href="/dashboard/schedule" className="text-gray-400 hover:text-amber-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> Scheduling tools
                </Link></li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6">
              <CreditCard className="w-10 h-10 text-purple-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-3">Billing & Plans</h3>
              <ul className="space-y-2">
                <li><Link href="/pricing" className="text-gray-400 hover:text-purple-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> Pricing comparison
                </Link></li>
                <li><Link href="/dashboard/settings" className="text-gray-400 hover:text-purple-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> Upgrade or downgrade
                </Link></li>
                <li><Link href="/dashboard/settings" className="text-gray-400 hover:text-purple-400 flex items-center gap-2">
                  <ChevronRight className="w-4 h-4" /> Payment methods
                </Link></li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card variant="glass-primary" className="p-12">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Still Need Help?
                </h2>
                <p className="text-gray-300 mb-6">
                  Our support team is available 24/7 to help you get the most out of Synthex.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300">support@synthex.social</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300">Live chat available 24/7</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-cyan-400" />
                    <span className="text-gray-300">Average response time: 2 hours</span>
                  </div>
                </div>
              </div>
              <div>
                <form className="space-y-4">
                  <input
                    type="text"
                    placeholder="Your name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                  />
                  <input
                    type="email"
                    placeholder="Your email"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400"
                  />
                  <textarea
                    placeholder="How can we help?"
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-cyan-400 resize-none"
                  />
                  <Button className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
                    Send Message
                  </Button>
                </form>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}