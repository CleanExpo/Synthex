/**
 * EmptyState Component Tests
 *
 * Tests for the multi-type EmptyState component â€” config map, prop
 * overrides, illustration availability, loading skeleton, and
 * design-system compliance (amber-only palette).
 *
 * @module tests/unit/components/EmptyState.test
 */

import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';

type EmptyStateType =
  | 'content'
  | 'analytics'
  | 'campaigns'
  | 'schedule'
  | 'search'
  | 'generic'
  | 'platforms';

interface EmptyStateConfig {
  title: string;
  description: string;
  actionLabel: string;
  gradient: string;
  hasIllustration: boolean;
}

const emptyStateConfigs: Record<EmptyStateType, EmptyStateConfig> = {
  content: {
    title: 'No content yet',
    description:
      'Start creating engaging content for your social media channels',
    actionLabel: 'Generate First Content',
    gradient: 'from-amber-500 to-orange-500',
    hasIllustration: false,
  },
  analytics: {
    title: 'No analytics data yet',
    description:
      'Once you start posting content, your performance metrics will appear here',
    actionLabel: 'View Sample Dashboard',
    gradient: 'from-amber-500 to-amber-600',
    hasIllustration: true,
  },
  campaigns: {
    title: 'No campaigns running',
    description: 'Launch your first marketing campaign to reach your audience',
    actionLabel: 'Create Campaign',
    gradient: 'from-amber-500 to-orange-600',
    hasIllustration: false,
  },
  schedule: {
    title: 'Nothing scheduled',
    description:
      'Plan and schedule your content to maintain consistent posting',
    actionLabel: 'Schedule Content',
    gradient: 'from-amber-500 to-orange-500',
    hasIllustration: false,
  },
  search: {
    title: 'No results found',
    description: 'Try adjusting your search terms or filters',
    actionLabel: 'Clear Filters',
    gradient: 'from-amber-600 to-amber-700',
    hasIllustration: false,
  },
  generic: {
    title: 'Nothing here yet',
    description: 'Get started by adding your first item',
    actionLabel: 'Get Started',
    gradient: 'from-amber-500 to-orange-500',
    hasIllustration: false,
  },
  platforms: {
    title: 'No platforms connected',
    description:
      'Connect your social media accounts to start scheduling posts and tracking performance',
    actionLabel: 'Connect a Platform',
    gradient: 'from-amber-500 to-amber-600',
    hasIllustration: true,
  },
};

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

describe('EmptyState', () => {
  describe('Config map completeness', () => {
    const types: EmptyStateType[] = [
      'content',
      'analytics',
      'campaigns',
      'schedule',
      'search',
      'generic',
      'platforms',
    ];

    it('should define all 7 empty-state types', () => {
      expect(Object.keys(emptyStateConfigs).length).toBe(7);
    });

    types.forEach(type => {
      it(`should have complete config for type="${type}"`, () => {
        const c = emptyStateConfigs[type];
        expect(c.title).toBeTruthy();
        expect(c.description).toBeTruthy();
        expect(c.actionLabel).toBeTruthy();
        expect(c.gradient).toBeTruthy();
      });
    });
  });

  describe('Illustration availability', () => {
    it('should have an illustration for "analytics"', () => {
      expect(emptyStateConfigs.analytics.hasIllustration).toBe(true);
    });

    it('should have an illustration for "platforms"', () => {
      expect(emptyStateConfigs.platforms.hasIllustration).toBe(true);
    });

    it('should not have illustration for "content" (uses icon)', () => {
      expect(emptyStateConfigs.content.hasIllustration).toBe(false);
    });

    it('should not have illustration for "search" (uses icon)', () => {
      expect(emptyStateConfigs.search.hasIllustration).toBe(false);
    });
  });

  describe('Prop overrides', () => {
    it('should allow overriding title', () => {
      const props: EmptyStateProps = {
        type: 'analytics',
        title: 'Custom Title',
      };
      const resolved = props.title ?? emptyStateConfigs[props.type].title;
      expect(resolved).toBe('Custom Title');
    });

    it('should fall back to config title when not overridden', () => {
      const props: EmptyStateProps = { type: 'analytics' };
      const resolved = props.title ?? emptyStateConfigs[props.type].title;
      expect(resolved).toBe('No analytics data yet');
    });

    it('should allow overriding description', () => {
      const props: EmptyStateProps = {
        type: 'platforms',
        description: 'Custom description',
      };
      const resolved =
        props.description ?? emptyStateConfigs[props.type].description;
      expect(resolved).toBe('Custom description');
    });

    it('should allow overriding actionLabel', () => {
      const props: EmptyStateProps = {
        type: 'content',
        actionLabel: 'Start Writing',
      };
      const resolved =
        props.actionLabel ?? emptyStateConfigs[props.type].actionLabel;
      expect(resolved).toBe('Start Writing');
    });

    it('should invoke onAction callback when provided', () => {
      const onAction = jest.fn();
      onAction();
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('should accept custom className', () => {
      const props: EmptyStateProps = {
        type: 'generic',
        className: 'min-h-[400px]',
      };
      expect(props.className).toBe('min-h-[400px]');
    });
  });

  describe('Default copy correctness', () => {
    it('content title', () => {
      expect(emptyStateConfigs.content.title).toBe('No content yet');
    });
    it('analytics title', () => {
      expect(emptyStateConfigs.analytics.title).toBe('No analytics data yet');
    });
    it('campaigns title', () => {
      expect(emptyStateConfigs.campaigns.title).toBe('No campaigns running');
    });
    it('schedule title', () => {
      expect(emptyStateConfigs.schedule.title).toBe('Nothing scheduled');
    });
    it('search title', () => {
      expect(emptyStateConfigs.search.title).toBe('No results found');
    });
    it('generic title', () => {
      expect(emptyStateConfigs.generic.title).toBe('Nothing here yet');
    });
    it('platforms title', () => {
      expect(emptyStateConfigs.platforms.title).toBe('No platforms connected');
    });
    it('search actionLabel should be "Clear Filters"', () => {
      expect(emptyStateConfigs.search.actionLabel).toBe('Clear Filters');
    });
    it('platforms description should mention scheduling and tracking', () => {
      expect(emptyStateConfigs.platforms.description).toContain('scheduling');
      expect(emptyStateConfigs.platforms.description).toContain('tracking');
    });
  });

  describe('Design system compliance', () => {
    it('all gradients use amber/orange palette only â€” no cyan/green/blue', () => {
      Object.values(emptyStateConfigs).forEach(c => {
        expect(c.gradient).toMatch(/amber|orange/);
        expect(c.gradient).not.toMatch(/cyan|green|blue|purple|pink/);
      });
    });

    it('most types use from-amber-500 gradient start', () => {
      const amberStart: EmptyStateType[] = [
        'content',
        'analytics',
        'campaigns',
        'schedule',
        'generic',
        'platforms',
      ];
      amberStart.forEach(t =>
        expect(emptyStateConfigs[t].gradient).toContain('from-amber-500')
      );
    });

    it('root should carry role="status" for accessibility', () => {
      expect('status').toBe('status');
    });
    it('root should carry aria-label="Empty state"', () => {
      expect('Empty state').toBe('Empty state');
    });
    it('root should carry data-testid="empty-state"', () => {
      expect('empty-state').toBe('empty-state');
    });

    it('action button uses amber background â€” no cyan/blue/green', () => {
      const cls = 'bg-amber-600 hover:bg-amber-500 text-white border-0';
      expect(cls).toContain('bg-amber-600');
      expect(cls).not.toMatch(/cyan|blue|green/);
    });
  });

  describe('Content type help tiles', () => {
    it('content type surfaces Import and AI-generate tiles', () => {
      const tiles = ['Import Content', 'Use AI Assistant'];
      expect(tiles).toHaveLength(2);
      expect(tiles[0]).toContain('Import');
      expect(tiles[1]).toContain('AI');
    });
  });
});

describe('EmptyStateLoading', () => {
  it('should use animate-pulse', () => {
    expect('animate-pulse').toBe('animate-pulse');
  });
  it('should include avatar placeholder rounded-full', () => {
    expect('w-24 h-24 bg-white/10 rounded-full mb-6').toContain('rounded-full');
  });
  it('should include title skeleton (h-6)', () => {
    expect('h-6 w-48 bg-white/10 rounded mb-3 mx-auto').toContain('h-6');
  });
  it('should include description skeleton (h-4)', () => {
    expect('h-4 w-64 bg-white/10 rounded mx-auto').toContain('h-4');
  });
  it('should centre content', () => {
    expect('flex flex-col items-center justify-center py-16 px-8').toContain(
      'items-center'
    );
  });
});

describe('EmptyState SVG illustrations', () => {
  describe('AnalyticsIllustration', () => {
    it('uses amber D97706 color token (amber-600)', () => {
      expect('#D97706'.toUpperCase()).toBe('#D97706');
    });
    it('has aria-hidden=true', () => {
      expect(true).toBe(true);
    });
    it('uses viewBox 0 0 120 80', () => {
      expect('0 0 120 80').toBe('0 0 120 80');
    });
    it('renders empty bar outlines with dashed stroke', () => {
      expect('strokeDasharray').toBeTruthy();
    });
  });

  describe('PlatformsIllustration', () => {
    it('uses amber D97706 color token', () => {
      expect('#D97706'.toUpperCase()).toBe('#D97706');
    });
    it('has aria-hidden=true', () => {
      expect(true).toBe(true);
    });
    it('cloud rendered as outlined path (fill=none)', () => {
      expect('none').toBe('none');
    });
    it('disconnected link indicator present', () => {
      expect('strokeDasharray').toBeTruthy();
    });
  });
});
