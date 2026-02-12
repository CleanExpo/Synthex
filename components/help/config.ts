/**
 * Help Center Config
 * Categories and FAQ data
 */

import {
  Zap,
  Sparkles,
  BarChart,
  Calendar,
  Users,
  CreditCard,
} from '@/components/icons';
import type { HelpCategory, FAQ } from './types';

export const HELP_CATEGORIES: HelpCategory[] = [
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
      { title: 'Connecting social accounts', href: '/dashboard/integrations' },
    ],
  },
  {
    id: 'content-creation',
    title: 'Content Creation',
    description: 'Master AI-powered content generation',
    icon: Sparkles,
    articles: 18,
    color: 'text-cyan-400',
    links: [
      { title: 'Using AI for content', href: '/dashboard/content' },
      { title: 'Content templates', href: '/dashboard/content' },
      { title: 'Best practices', href: '/docs/best-practices' },
    ],
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
      { title: 'Export data', href: '/dashboard/analytics' },
    ],
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
      { title: 'Time zone settings', href: '/dashboard/settings' },
    ],
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
      { title: 'Approval workflows', href: '/dashboard/team' },
    ],
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
      { title: 'Download invoices', href: '/dashboard/settings' },
    ],
  },
];

export const FAQS: FAQ[] = [
  {
    question: 'How do I connect my social media accounts?',
    answer: 'Go to Dashboard > Integrations and click "Connect" on any platform you want to add.',
    category: 'getting-started',
  },
  {
    question: 'Can I schedule posts for multiple platforms at once?',
    answer: 'Yes! When creating content, you can select multiple platforms and customize the content for each.',
    category: 'scheduling',
  },
  {
    question: 'How does the AI content generation work?',
    answer: 'Our AI analyzes your brand voice, audience preferences, and trending topics to generate engaging content tailored to each platform.',
    category: 'content-creation',
  },
  {
    question: 'What analytics metrics are available?',
    answer: 'We track engagement rate, reach, impressions, clicks, shares, and custom conversion metrics across all connected platforms.',
    category: 'analytics',
  },
  {
    question: 'Can I add team members to my account?',
    answer: 'Yes, depending on your plan. Go to Dashboard > Team to invite members and assign roles.',
    category: 'team',
  },
  {
    question: 'How do I upgrade my plan?',
    answer: 'Visit Dashboard > Settings > Billing or go to the Pricing page to compare and upgrade plans.',
    category: 'billing',
  },
];

export function filterFAQs(
  faqs: FAQ[],
  searchQuery: string,
  selectedCategory: string | null
): FAQ[] {
  return faqs.filter(
    (faq) =>
      (!selectedCategory || faq.category === selectedCategory) &&
      (!searchQuery ||
        faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
        faq.answer.toLowerCase().includes(searchQuery.toLowerCase()))
  );
}
