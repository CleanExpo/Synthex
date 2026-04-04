'use client';

import type { ComponentType } from 'react';
import Link from 'next/link';
import {
  FileText,
  Mic,
  Video,
  Calendar,
  BarChart3,
  Search,
} from '@/components/icons';
import { HelpVideo } from '@/components/ui/HelpVideo';

// ============================================================================
// TYPES
// ============================================================================

interface CISCard {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  href: string;
}

// ============================================================================
// DATA
// ============================================================================

const CIS_CARDS: CISCard[] = [
  {
    icon: FileText,
    title: 'Content Studio',
    description: 'Create and schedule AI-powered content across all platforms',
    href: '/dashboard/content',
  },
  {
    icon: Mic,
    title: 'Brand Voice',
    description: 'Train your AI on your unique tone and communication style',
    href: '/dashboard/brand-voice',
  },
  {
    icon: Video,
    title: 'Video Engine',
    description: 'Transform long-form video into platform-optimised clips',
    href: '/dashboard/visuals',
  },
  {
    icon: Calendar,
    title: 'Scheduler',
    description: 'Plan and automate your posting schedule across platforms',
    href: '/dashboard/schedule',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description:
      'Track performance and insights across all connected platforms',
    href: '/dashboard/analytics',
  },
  {
    icon: Search,
    title: 'Research',
    description: 'Discover trends and insights to inform your content strategy',
    href: '/dashboard/research',
  },
];

// ============================================================================
// CARD GRID COMPONENT
// ============================================================================

function CISCardGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {CIS_CARDS.map((card, i) => {
        const Icon = card.icon;
        return (
          <div
            key={card.href}
            className="border border-white/[0.06] bg-white/[0.01] backdrop-blur-sm rounded-xl p-6 flex flex-col gap-4 hover:border-white/[0.12] hover:bg-white/[0.03] transition-colors duration-200"
          >
            {/* Icon */}
            <div className="flex items-center justify-start">
              <Icon className="w-6 h-6 text-orange-400" />
            </div>

            {/* Title + Description */}
            <div className="flex-1 space-y-1.5">
              <h3 className="text-sm font-semibold text-white tracking-wide">
                {card.title}
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
                {card.description}
              </p>
            </div>

            {/* CTA */}
            <Link
              href={card.href}
              aria-label={`Open ${card.title}`}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 transition-colors mt-auto"
            >
              Open →
            </Link>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================================
// PAGE
// ============================================================================

export default function CreativeSuitePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-light text-white tracking-wide">
            Creative Intelligence Suite
          </h1>
          <HelpVideo videoId="workflow-overview" />
        </div>
        <p className="text-sm text-white/50">
          Your complete AI marketing toolkit
        </p>
        <div className="h-px bg-white/[0.06] mt-4" />
      </div>

      {/* Card Grid */}
      <CISCardGrid />
    </div>
  );
}
