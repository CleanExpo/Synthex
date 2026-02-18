'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FileText,
  BarChart3,
  Calendar,
  Settings,
  User,
  Plus,
  Sparkles,
  TrendingUp,
  LogOut,
  Home,
  Command,
  ArrowRight,
  File,
  Beaker,
  CreditCard,
  Users,
  Target,
  Brain,
  HelpCircle,
  Layers,
  Lightbulb,
  Layout,
  Zap,
  Link2,
  GitBranch as GitPullRequest,
  MessageSquare,
  Shield,
  Code,
  Image,
  Repeat,
  Send,
  Bell,
  Grid,
} from '@/components/icons';
import { notify } from '@/lib/notifications';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  category: 'navigation' | 'actions' | 'settings' | 'help';
  keywords: string[];
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'dashboard',
      title: 'Go to Dashboard',
      icon: Home,
      action: () => router.push('/dashboard'),
      category: 'navigation',
      keywords: ['home', 'dashboard', 'main']
    },
    {
      id: 'content',
      title: 'Content Generator',
      icon: FileText,
      action: () => router.push('/dashboard/content'),
      category: 'navigation',
      keywords: ['content', 'generate', 'create', 'write']
    },
    {
      id: 'content-optimizer',
      title: 'Content Optimizer',
      description: 'Score and optimize content quality',
      icon: Sparkles,
      action: () => router.push('/dashboard/content/optimize'),
      category: 'navigation',
      keywords: ['optimize', 'score', 'quality', 'improve', 'suggestions', 'content optimizer']
    },
    {
      id: 'multi-format',
      title: 'Multi-format Generator',
      description: 'Generate content for multiple platforms at once',
      icon: Layers,
      action: () => router.push('/dashboard/content/multi-format'),
      category: 'navigation',
      keywords: ['multi-format', 'platforms', 'generate', 'variations', 'cross-platform', 'adapt', 'convert']
    },
    {
      id: 'repurpose',
      title: 'Content Repurposer',
      description: 'Transform long-form content into threads, video scripts, and more',
      icon: Repeat,
      action: () => router.push('/dashboard/content/repurpose'),
      category: 'navigation',
      keywords: ['repurpose', 'transform', 'blog', 'thread', 'video script', 'carousel', 'summary', 'takeaways', 'transcript', 'podcast']
    },
    {
      id: 'cross-post',
      title: 'Cross-Post',
      description: 'Publish content to multiple platforms with AI-powered adaptation',
      icon: Send,
      action: () => router.push('/dashboard/content/cross-post'),
      category: 'navigation',
      keywords: ['cross-post', 'cross post', 'publish', 'multi-platform', 'post everywhere', 'broadcast', 'distribute', 'social media']
    },
    {
      id: 'analytics',
      title: 'Analytics',
      icon: BarChart3,
      action: () => router.push('/dashboard/analytics'),
      category: 'navigation',
      keywords: ['analytics', 'stats', 'metrics', 'data']
    },
    {
      id: 'predictions',
      title: 'Predictive Analytics',
      description: 'ML-powered engagement predictions and optimal posting times',
      icon: Lightbulb,
      action: () => router.push('/dashboard/predictions'),
      category: 'navigation',
      keywords: ['predict', 'forecast', 'engagement', 'optimal', 'best time', 'ml', 'ai', 'prediction']
    },
    {
      id: 'schedule',
      title: 'Schedule',
      icon: Calendar,
      action: () => router.push('/dashboard/schedule'),
      category: 'navigation',
      keywords: ['schedule', 'calendar', 'plan']
    },
    {
      id: 'calendar',
      title: 'Go to Calendar',
      description: 'Visual content calendar with drag-drop scheduling',
      icon: Calendar,
      action: () => router.push('/dashboard/calendar'),
      category: 'navigation',
      keywords: ['calendar', 'week', 'month', 'schedule', 'drag', 'drop']
    },
    {
      id: 'schedule-post',
      title: 'Schedule Post',
      description: 'Open quick scheduler to add a new post',
      icon: Plus,
      action: () => router.push('/dashboard/calendar?action=schedule'),
      category: 'actions',
      keywords: ['schedule', 'post', 'create', 'new', 'add', 'content']
    },
    {
      id: 'reports',
      title: 'Reports',
      description: 'Generate performance reports',
      icon: File,
      action: () => router.push('/dashboard/reports'),
      category: 'navigation',
      keywords: ['reports', 'generate', 'export', 'pdf']
    },
    {
      id: 'report-builder',
      title: 'Report Builder',
      description: 'Create custom report templates with drag-drop widgets',
      icon: Layout,
      action: () => router.push('/dashboard/reports/builder'),
      category: 'navigation',
      keywords: ['report', 'builder', 'custom', 'template', 'widget', 'drag', 'drop']
    },
    {
      id: 'experiments',
      title: 'Experiments',
      description: 'A/B testing and optimization',
      icon: Beaker,
      action: () => router.push('/dashboard/experiments'),
      category: 'navigation',
      keywords: ['experiments', 'ab testing', 'test', 'variants']
    },
    {
      id: 'personas',
      title: 'Personas',
      description: 'AI brand voice personas',
      icon: Brain,
      action: () => router.push('/dashboard/personas'),
      category: 'navigation',
      keywords: ['personas', 'brand voice', 'ai']
    },
    {
      id: 'ai-chat',
      title: 'AI Chat Assistant',
      description: 'Get AI-powered help with content strategy',
      icon: MessageSquare,
      action: () => router.push('/dashboard/ai-chat'),
      category: 'navigation',
      keywords: ['ai', 'chat', 'assistant', 'help', 'strategy', 'ideas', 'conversation']
    },
    {
      id: 'ai-images',
      title: 'AI Images',
      description: 'Generate images with AI',
      icon: Image,
      action: () => router.push('/dashboard/ai-images'),
      category: 'navigation',
      keywords: ['image', 'generate', 'ai', 'visual', 'picture', 'dalle', 'stability', 'gemini']
    },
    {
      id: 'competitors',
      title: 'Competitors',
      description: 'Track competitor activity',
      icon: Target,
      action: () => router.push('/dashboard/competitors'),
      category: 'navigation',
      keywords: ['competitors', 'competition', 'tracking']
    },
    {
      id: 'social-listening',
      title: 'Social Listening',
      description: 'Monitor brand mentions, keywords, and hashtags',
      icon: Bell,
      action: () => router.push('/dashboard/listening'),
      category: 'navigation',
      keywords: ['listening', 'mentions', 'brand', 'monitor', 'keywords', 'hashtags', 'sentiment', 'social']
    },
    {
      id: 'link-in-bio',
      title: 'Link in Bio Pages',
      description: 'Create and manage customizable landing pages',
      icon: Link2,
      action: () => router.push('/dashboard/bio'),
      category: 'navigation',
      keywords: ['bio', 'link', 'linktree', 'landing', 'page', 'profile', 'links']
    },
    {
      id: 'unified-dashboard',
      title: 'Unified Dashboard',
      description: 'View all platform metrics in one place',
      icon: Grid,
      action: () => router.push('/dashboard/unified'),
      category: 'navigation',
      keywords: ['unified', 'all', 'platforms', 'metrics', 'overview', 'compare', 'aggregate']
    },
    {
      id: 'audience-insights',
      title: 'Audience Insights',
      description: 'View follower demographics and behavior',
      icon: Users,
      action: () => router.push('/dashboard/audience'),
      category: 'navigation',
      keywords: ['audience', 'demographics', 'followers', 'insights', 'age', 'gender', 'location']
    },
    {
      id: 'team',
      title: 'Team',
      description: 'Manage team members',
      icon: Users,
      action: () => router.push('/dashboard/team'),
      category: 'navigation',
      keywords: ['team', 'members', 'collaboration']
    },
    {
      id: 'integrations',
      title: 'Integrations',
      description: 'Manage platform and third-party connections',
      icon: Zap,
      action: () => router.push('/dashboard/integrations'),
      category: 'navigation',
      keywords: ['integrations', 'connect', 'canva', 'buffer', 'zapier', 'third-party', 'tools']
    },
    {
      id: 'webhooks',
      title: 'Webhooks',
      description: 'Send real-time event notifications to external systems',
      icon: Link2,
      action: () => router.push('/dashboard/webhooks'),
      category: 'navigation',
      keywords: ['webhooks', 'webhook', 'endpoints', 'subscriptions', 'events', 'notifications', 'outbound']
    },
    {
      id: 'approvals',
      title: 'Approvals',
      description: 'Review and approve content before publishing',
      icon: GitPullRequest,
      action: () => router.push('/dashboard/approvals'),
      category: 'navigation',
      keywords: ['approvals', 'approval', 'workflow', 'review', 'approve', 'reject', 'content', 'pending']
    },
    {
      id: 'collaboration',
      title: 'Team Collaboration',
      description: 'Activity feed, comments, and shared content',
      icon: MessageSquare,
      action: () => router.push('/dashboard/collaboration'),
      category: 'navigation',
      keywords: ['collaboration', 'team', 'activity', 'comments', 'shares', 'feed', 'assign']
    },
    {
      id: 'roles',
      title: 'Role Management',
      description: 'Manage roles and permissions',
      icon: Shield,
      action: () => router.push('/dashboard/roles'),
      category: 'navigation',
      keywords: ['roles', 'permissions', 'access', 'rbac', 'admin', 'editor', 'viewer', 'grant', 'revoke']
    },
    {
      id: 'technical-seo',
      title: 'Technical SEO',
      description: 'Core Web Vitals, mobile parity, robots.txt validation',
      icon: Search,
      action: () => router.push('/dashboard/seo/technical'),
      category: 'navigation',
      keywords: ['cwv', 'core web vitals', 'mobile', 'parity', 'robots', 'technical', 'seo', 'performance']
    },
    {
      id: 'search-console',
      title: 'Search Console',
      description: 'Search analytics, indexing status, sitemap health',
      icon: BarChart3,
      action: () => router.push('/dashboard/seo/search-console'),
      category: 'navigation',
      keywords: ['search console', 'gsc', 'google', 'indexing', 'sitemap', 'queries', 'clicks', 'impressions', 'ctr']
    },
    {
      id: 'pagespeed-insights',
      title: 'PageSpeed Insights',
      description: 'Page performance analysis, CWV monitoring, Lighthouse scores',
      icon: Zap,
      action: () => router.push('/dashboard/seo/pagespeed'),
      category: 'navigation',
      keywords: ['pagespeed', 'page speed', 'lighthouse', 'cwv', 'core web vitals', 'performance', 'lcp', 'cls', 'inp', 'speed']
    },
    {
      id: 'schema-markup-manager',
      title: 'Schema Markup Manager',
      description: 'Create, validate, and manage JSON-LD structured data',
      icon: Code,
      action: () => router.push('/dashboard/seo/schema'),
      category: 'navigation',
      keywords: ['schema', 'json-ld', 'structured data', 'markup', 'rich results', 'rich snippets', 'organization', 'product', 'article', 'faq', 'seo', 'validator', 'template']
    },
    {
      id: 'geo-readiness',
      title: 'GEO Readiness Dashboard',
      description: 'AI search citability scores, passage analysis, platform optimization',
      icon: Search,
      action: () => router.push('/dashboard/seo/geo-readiness'),
      category: 'navigation',
      keywords: ['geo', 'generative engine', 'ai search', 'citability', 'passages', 'readiness', 'google aio', 'chatgpt', 'perplexity', 'bing copilot', 'ai visibility']
    },
    {
      id: 'scheduled-audits',
      title: 'Scheduled Audits',
      description: 'Automated recurring SEO audits with regression alerts',
      icon: Calendar,
      action: () => router.push('/dashboard/seo/scheduled-audits'),
      category: 'navigation',
      keywords: ['scheduled', 'audits', 'automation', 'alerts', 'regression', 'monitoring', 'recurring', 'cron', 'seo']
    },

    // Actions
    {
      id: 'new-content',
      title: 'Create New Content',
      description: 'Generate AI-powered content',
      icon: Plus,
      action: () => {
        router.push('/dashboard/content');
        notify.custom('Ready to create amazing content! ✨');
      },
      category: 'actions',
      keywords: ['new', 'create', 'generate', 'ai']
    },
    {
      id: 'add-keyword',
      title: 'Add Tracked Keyword',
      description: 'Start monitoring a new keyword or hashtag',
      icon: Bell,
      action: () => router.push('/dashboard/listening?action=add'),
      category: 'actions',
      keywords: ['add', 'track', 'keyword', 'hashtag', 'monitor', 'listening', 'brand']
    },
    {
      id: 'create-bio-page',
      title: 'Create Bio Page',
      description: 'Create a new Link in Bio landing page',
      icon: Link2,
      action: () => router.push('/dashboard/bio?action=create'),
      category: 'actions',
      keywords: ['create', 'new', 'bio', 'link', 'page', 'landing', 'linktree']
    },
    {
      id: 'analyze-trends',
      title: 'Analyze Viral Trends',
      description: 'Discover what\'s trending now',
      icon: TrendingUp,
      action: () => {
        router.push('/dashboard/patterns');
        notify.loading('Analyzing trending patterns...');
      },
      category: 'actions',
      keywords: ['trends', 'viral', 'popular', 'analyze']
    },
    {
      id: 'quick-post',
      title: 'Quick Post',
      description: 'Post to all platforms',
      icon: Sparkles,
      action: () => {
        // Open quick post modal
        const event = new CustomEvent('openQuickPost');
        window.dispatchEvent(event);
      },
      category: 'actions',
      keywords: ['post', 'quick', 'publish', 'share']
    },
    {
      id: 'generate-image',
      title: 'Generate Image',
      description: 'Create a new AI image',
      icon: Sparkles,
      action: () => router.push('/dashboard/ai-images'),
      category: 'actions',
      keywords: ['create', 'new', 'image', 'generate', 'ai']
    },

    // Settings
    {
      id: 'settings',
      title: 'Settings',
      icon: Settings,
      action: () => router.push('/dashboard/settings'),
      category: 'settings',
      keywords: ['settings', 'preferences', 'config']
    },
    {
      id: 'profile',
      title: 'Profile',
      icon: User,
      action: () => router.push('/dashboard/settings#profile'),
      category: 'settings',
      keywords: ['profile', 'account', 'user']
    },
    {
      id: 'billing',
      title: 'Billing',
      description: 'Manage subscription and payments',
      icon: CreditCard,
      action: () => router.push('/dashboard/billing'),
      category: 'settings',
      keywords: ['billing', 'subscription', 'payment', 'invoice']
    },
    {
      id: 'logout',
      title: 'Sign Out',
      icon: LogOut,
      action: () => {
        localStorage.clear();
        notify.logoutSuccess();
        router.push('/login');
      },
      category: 'settings',
      keywords: ['logout', 'signout', 'exit']
    },

    // Help
    {
      id: 'help',
      title: 'Help & Support',
      description: 'Get help and documentation',
      icon: HelpCircle,
      action: () => router.push('/dashboard/help'),
      category: 'help',
      keywords: ['help', 'support', 'docs', 'faq']
    },
  ];

  // Filter commands based on search
  const filteredCommands = commands.filter(cmd => {
    const searchLower = search.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(searchLower) ||
      cmd.description?.toLowerCase().includes(searchLower) ||
      cmd.keywords.some(k => k.includes(searchLower))
    );
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen(true);
      }

      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            setIsOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    };

    // Custom event listener for opening
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('openCommandPalette', handleOpen);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('openCommandPalette', handleOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, selectedIndex, filteredCommands]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = listRef.current?.children[selectedIndex] as HTMLElement;
    selectedElement?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setIsOpen(false)}
      />

      {/* Command Palette */}
      <div className="fixed top-1/4 left-1/2 transform -translate-x-1/2 w-full max-w-2xl z-50">
        <div className="bg-white/[0.02] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b border-white/10 px-4">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type a command or search..."
              className="flex-1 px-4 py-4 bg-transparent text-white placeholder-gray-400 focus:outline-none"
            />
            <kbd className="px-2 py-1 text-xs bg-gray-800 rounded">ESC</kbd>
          </div>

          {/* Commands List */}
          <div ref={listRef} className="max-h-96 overflow-y-auto p-2">
            {Object.entries(groupedCommands).map(([category, items]) => (
              <div key={category} className="mb-4">
                <div className="px-2 py-1 text-xs text-gray-500 uppercase">
                  {category}
                </div>
                {items.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = filteredCommands.indexOf(cmd) === selectedIndex;

                  return (
                    <button
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        setIsOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left
                        transition-colors duration-150
                        ${isSelected
                          ? 'bg-cyan-500/20 text-white'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                        }
                      `}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{cmd.title}</div>
                        {cmd.description && (
                          <div className="text-xs text-gray-500 truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}

            {filteredCommands.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No commands found for &quot;{search}&quot;
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
            <div className="flex gap-4">
              <span><kbd>↑↓</kbd> Navigate</span>
              <span><kbd>↵</kbd> Select</span>
              <span><kbd>ESC</kbd> Close</span>
            </div>
            <div className="flex items-center gap-1">
              <Command className="w-3 h-3" />
              <span>+K</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
