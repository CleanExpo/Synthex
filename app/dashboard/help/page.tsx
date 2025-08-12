'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search,
  Book,
  MessageCircle,
  Mail,
  Phone,
  FileText,
  Video,
  Users,
  Zap,
  Shield,
  CreditCard,
  Settings,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  BookOpen,
  Sparkles,
  TrendingUp,
  Calendar,
  BarChart,
  Palette,
  Globe,
  Lock,
  AlertCircle,
  CheckCircle,
  Info
} from 'lucide-react';

interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: any;
  articles: number;
  color: string;
  links: { title: string; href: string }[];
}

interface FAQ {
  question: string;
  answer: string;
  category: string;
}

export default function HelpPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories: HelpCategory[] = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'Learn the basics of using SYNTHEX',
      icon: Zap,
      articles: 12,
      color: 'text-cyan-400',
      links: [
        { title: 'Quick start guide', href: '/docs/quickstart' },
        { title: 'Setting up your profile', href: '/dashboard/settings' },
        { title: 'Connecting social accounts', href: '/dashboard/integrations' }
      ]
    },
    {
      id: 'content-creation',
      title: 'Content Creation',
      description: 'Master AI-powered content generation',
      icon: Sparkles,
      articles: 18,
      color: 'text-purple-400',
      links: [
        { title: 'Using AI for content', href: '/dashboard/content' },
        { title: 'Content templates', href: '/dashboard/content' },
        { title: 'Best practices', href: '/docs/best-practices' }
      ]
    },
    {
      id: 'analytics',
      title: 'Analytics & Insights',
      description: 'Track and improve performance',
      icon: BarChart,
      articles: 15,
      color: 'text-green-400',
      links: [
        { title: 'Understanding metrics', href: '/dashboard/analytics' },
        { title: 'Custom reports', href: '/dashboard/analytics' },
        { title: 'Export data', href: '/dashboard/analytics' }
      ]
    },
    {
      id: 'scheduling',
      title: 'Scheduling',
      description: 'Plan and automate your posts',
      icon: Calendar,
      articles: 10,
      color: 'text-amber-400',
      links: [
        { title: 'Schedule posts', href: '/dashboard/schedule' },
        { title: 'Bulk scheduling', href: '/dashboard/schedule' },
        { title: 'Time zone settings', href: '/dashboard/settings' }
      ]
    },
    {
      id: 'team',
      title: 'Team Collaboration',
      description: 'Work together effectively',
      icon: Users,
      articles: 8,
      color: 'text-blue-400',
      links: [
        { title: 'Invite team members', href: '/dashboard/team' },
        { title: 'Roles and permissions', href: '/dashboard/team' },
        { title: 'Approval workflows', href: '/dashboard/team' }
      ]
    },
    {
      id: 'billing',
      title: 'Billing & Plans',
      description: 'Manage your subscription',
      icon: CreditCard,
      articles: 6,
      color: 'text-pink-400',
      links: [
        { title: 'View plans', href: '/pricing' },
        { title: 'Update payment method', href: '/dashboard/settings' },
        { title: 'Download invoices', href: '/dashboard/settings' }
      ]
    }
  ];

  const faqs: FAQ[] = [
    {
      question: 'How do I connect my social media accounts?',
      answer: 'Go to Dashboard > Integrations and click "Connect" on any platform you want to add.',
      category: 'getting-started'
    },
    {
      question: 'Can I schedule posts for multiple platforms at once?',
      answer: 'Yes! When creating content, you can select multiple platforms and customize the content for each.',
      category: 'scheduling'
    },
    {
      question: 'How does the AI content generation work?',
      answer: 'Our AI analyzes your brand voice, audience preferences, and trending topics to generate engaging content tailored to each platform.',
      category: 'content-creation'
    },
    {
      question: 'What analytics metrics are available?',
      answer: 'We track engagement rate, reach, impressions, clicks, shares, and custom conversion metrics across all connected platforms.',
      category: 'analytics'
    },
    {
      question: 'Can I add team members to my account?',
      answer: 'Yes, depending on your plan. Go to Dashboard > Team to invite members and assign roles.',
      category: 'team'
    },
    {
      question: 'How do I upgrade my plan?',
      answer: 'Visit Dashboard > Settings > Billing or go to the Pricing page to compare and upgrade plans.',
      category: 'billing'
    }
  ];

  const filteredFAQs = faqs.filter(faq => 
    (!selectedCategory || faq.category === selectedCategory) &&
    (!searchQuery || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Help Center</h1>
        <p className="text-gray-400">
          Find answers, learn best practices, and get the most out of SYNTHEX
        </p>
      </div>

      {/* Search Bar */}
      <Card className="liquid-glass mb-8">
        <CardContent className="p-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search for help articles, tutorials, or FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-gray-800/50 border-white/10 text-white"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
        <Card className="liquid-glass hover:scale-105 transition-transform cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
                <Video className="w-6 h-6 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Video Tutorials</h3>
                <p className="text-sm text-gray-400">Learn with step-by-step guides</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass hover:scale-105 transition-transform cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                <MessageCircle className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Live Chat</h3>
                <p className="text-sm text-gray-400">Chat with our support team</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
            </div>
          </CardContent>
        </Card>

        <Card className="liquid-glass hover:scale-105 transition-transform cursor-pointer">
          <Link href="/docs" className="block">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                  <BookOpen className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Documentation</h3>
                  <p className="text-sm text-gray-400">Detailed technical guides</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 ml-auto" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Help Categories */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-white mb-4">Browse by Category</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <Card 
                key={category.id} 
                className={`liquid-glass hover:scale-105 transition-transform cursor-pointer ${
                  selectedCategory === category.id ? 'ring-2 ring-purple-500' : ''
                }`}
                onClick={() => setSelectedCategory(
                  selectedCategory === category.id ? null : category.id
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className={`p-2 rounded-lg bg-gray-800/50 ${category.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {category.articles} articles
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mt-3">{category.title}</CardTitle>
                  <CardDescription>{category.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {category.links.map((link, index) => (
                      <li key={index}>
                        <Link 
                          href={link.href}
                          className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
                        >
                          <ChevronRight className="w-3 h-3" />
                          {link.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* FAQs */}
      <Card className="liquid-glass">
        <CardHeader>
          <CardTitle>Frequently Asked Questions</CardTitle>
          {selectedCategory && (
            <Badge 
              variant="secondary" 
              className="mt-2 cursor-pointer"
              onClick={() => setSelectedCategory(null)}
            >
              {categories.find(c => c.id === selectedCategory)?.title} ✕
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredFAQs.map((faq, index) => (
              <div key={index} className="border-b border-white/10 pb-4 last:border-0">
                <h4 className="font-medium text-white mb-2 flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                  {faq.question}
                </h4>
                <p className="text-sm text-gray-400 ml-6">{faq.answer}</p>
              </div>
            ))}
            {filteredFAQs.length === 0 && (
              <p className="text-gray-400 text-center py-8">
                No FAQs found. Try adjusting your search or category filter.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact Support */}
      <Card className="liquid-glass mt-8">
        <CardHeader>
          <CardTitle>Still need help?</CardTitle>
          <CardDescription>Our support team is here to assist you</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="justify-start">
              <Mail className="w-4 h-4 mr-2" />
              support@synthex.social
            </Button>
            <Button variant="outline" className="justify-start">
              <MessageCircle className="w-4 h-4 mr-2" />
              Start Live Chat
            </Button>
            <Button variant="outline" className="justify-start">
              <Phone className="w-4 h-4 mr-2" />
              Schedule a Call
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}