'use client';

import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Card } from '@/components/ui/card';
import { Clock, Sparkles, Zap, Shield, TrendingUp } from '@/components/icons';

const changelogEntries = [
  {
    version: '2.0.0',
    date: 'January 2025',
    title: 'Major Platform Redesign',
    type: 'major',
    changes: [
      'Complete UI overhaul with new Synthex branding',
      'Deep navy theme with cyan accents',
      'Improved performance and faster load times',
      'New AI content generation engine',
      'Enhanced analytics dashboard'
    ]
  },
  {
    version: '1.5.0',
    date: 'December 2024',
    title: 'AI Enhancements',
    type: 'feature',
    changes: [
      'Improved content generation quality',
      'Multi-language support added',
      'Brand voice training capabilities',
      'Hashtag optimization tools',
      'Content scheduling improvements'
    ]
  },
  {
    version: '1.4.0',
    date: 'November 2024',
    title: 'Security Updates',
    type: 'security',
    changes: [
      'Enhanced OAuth security',
      'Two-factor authentication support',
      'Improved API rate limiting',
      'Security audit compliance updates',
      'GDPR compliance enhancements'
    ]
  },
  {
    version: '1.3.0',
    date: 'October 2024',
    title: 'Analytics & Insights',
    type: 'feature',
    changes: [
      'Real-time analytics dashboard',
      'Engagement prediction models',
      'Competitor analysis tools',
      'Custom report generation',
      'Export functionality improvements'
    ]
  }
];

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'major':
      return <Sparkles className="w-5 h-5 text-cyan-400" />;
    case 'feature':
      return <Zap className="w-5 h-5 text-cyan-400" />;
    case 'security':
      return <Shield className="w-5 h-5 text-amber-400" />;
    default:
      return <TrendingUp className="w-5 h-5 text-cyan-400" />;
  }
};

const getTypeBadge = (type: string) => {
  switch (type) {
    case 'major':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'feature':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'security':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

export default function ChangelogPage() {
  return (
    <MarketingLayout currentPage="changelog">
      {/* Hero Section */}
      <section className="pt-12 pb-12 px-6">
        <div className="container mx-auto text-center">
          <Clock className="w-16 h-16 text-cyan-400 mx-auto mb-6" />
          <h1 className="text-5xl font-bold text-white mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-500">Changelog</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Stay up to date with the latest features, improvements, and fixes to the Synthex platform.
          </p>
        </div>
      </section>

      {/* Changelog Entries */}
      <section className="px-6 pb-20">
        <div className="container mx-auto max-w-4xl">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-cyan-500/50 via-cyan-500/20 to-transparent hidden md:block" />

            <div className="space-y-8">
              {changelogEntries.map((entry, index) => (
                <div key={index} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute left-6 top-8 w-4 h-4 rounded-full bg-cyan-500 border-4 border-surface-dark hidden md:block" />

                  <Card className="bg-surface-base/80 border border-cyan-500/20 backdrop-blur-sm p-6 md:ml-16">
                    <div className="flex flex-wrap items-center gap-3 mb-4">
                      {getTypeIcon(entry.type)}
                      <span className="text-white font-bold text-lg">{entry.version}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getTypeBadge(entry.type)}`}>
                        {entry.type.charAt(0).toUpperCase() + entry.type.slice(1)}
                      </span>
                      <span className="text-gray-500 text-sm ml-auto">{entry.date}</span>
                    </div>

                    <h3 className="text-xl font-semibold text-white mb-4">{entry.title}</h3>

                    <ul className="space-y-2">
                      {entry.changes.map((change, idx) => (
                        <li key={idx} className="text-gray-300 flex items-start gap-2">
                          <span className="text-cyan-400 mt-1">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Subscribe Section */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-gradient-to-br from-[#0f172a] to-[#1e293b] border border-cyan-500/30 p-12 text-center max-w-3xl mx-auto">
            <Sparkles className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Stay Updated
            </h2>
            <p className="text-gray-300 mb-6">
              Get notified about new features and updates. We'll keep you in the loop.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 px-4 py-3 bg-surface-dark border border-cyan-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 transition-colors"
              />
              <button className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-medium rounded-lg shadow-lg shadow-cyan-500/25 transition-all">
                Subscribe
              </button>
            </div>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
