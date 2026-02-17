import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = PAGE_METADATA.docs;
import {
  BookOpen, Code, Zap, Users,
  Settings, Shield, HelpCircle, ArrowRight
} from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

export default function DocsPage() {
  return (
    <MarketingLayout currentPage="docs">
      {/* Hero Section */}
      <section className="pt-12 pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-6">
              Documentation
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need to know about using Synthex to grow your social media presence
            </p>
          </div>

          {/* Documentation Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="p-6 bg-white/[0.02] backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group">
              <Zap className="w-10 h-10 text-cyan-400 mb-4 group-hover:text-cyan-300 transition-colors" />
              <h3 className="text-xl font-semibold text-white mb-2">Getting Started</h3>
              <p className="text-gray-500 mb-4">
                Quick setup guide to get you running in minutes
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Account setup</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Connecting social accounts</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />First AI persona</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Your first post</li>
              </ul>
            </Card>

            <Card className="p-6 bg-white/[0.02] backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group">
              <BookOpen className="w-10 h-10 text-cyan-400 mb-4 group-hover:text-cyan-300 transition-colors" />
              <h3 className="text-xl font-semibold text-white mb-2">User Guide</h3>
              <p className="text-gray-500 mb-4">
                Comprehensive guide to all features
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Persona training</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Content generation</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Scheduling posts</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Analytics dashboard</li>
              </ul>
            </Card>

            <Card className="p-6 bg-white/[0.02] backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group">
              <Code className="w-10 h-10 text-cyan-400 mb-4 group-hover:text-cyan-300 transition-colors" />
              <h3 className="text-xl font-semibold text-white mb-2">API Reference</h3>
              <p className="text-gray-500 mb-4">
                Developer documentation for integrations
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Authentication</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Endpoints</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Rate limits</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Webhooks</li>
              </ul>
            </Card>

            <Card className="p-6 bg-white/[0.02] backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group">
              <Settings className="w-10 h-10 text-cyan-400 mb-4 group-hover:text-cyan-300 transition-colors" />
              <h3 className="text-xl font-semibold text-white mb-2">Advanced Features</h3>
              <p className="text-gray-500 mb-4">
                Master the advanced capabilities
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Custom AI training</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Viral pattern analysis</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />A/B testing</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Automation workflows</li>
              </ul>
            </Card>

            <Card className="p-6 bg-white/[0.02] backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group">
              <Users className="w-10 h-10 text-cyan-400 mb-4 group-hover:text-cyan-300 transition-colors" />
              <h3 className="text-xl font-semibold text-white mb-2">Team Collaboration</h3>
              <p className="text-gray-500 mb-4">
                Working with teams and agencies
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />User roles</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Approval workflows</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Client management</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />White-label options</li>
              </ul>
            </Card>

            <Card className="p-6 bg-white/[0.02] backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group">
              <Shield className="w-10 h-10 text-cyan-400 mb-4 group-hover:text-cyan-300 transition-colors" />
              <h3 className="text-xl font-semibold text-white mb-2">Security & Privacy</h3>
              <p className="text-gray-500 mb-4">
                How we protect your data
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Data encryption</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Privacy policy</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />GDPR compliance</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 bg-cyan-400 rounded-full" />Security best practices</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-20 px-6 bg-white/[0.01] border-y border-cyan-500/10">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-12">Popular Articles</h2>
          <div className="max-w-4xl mx-auto space-y-4">
            {[
              'How to create your first AI persona',
              'Optimizing content for maximum engagement',
              'Understanding viral pattern analytics',
              'Best practices for multi-platform posting',
              'Setting up automated workflows',
              'Interpreting your analytics dashboard',
            ].map((article) => (
              <Card key={article} className="p-4 bg-white/[0.02] backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-500/30 hover:bg-white/[0.04] transition-all duration-300 cursor-pointer group">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300 group-hover:text-white transition-colors">{article}</span>
                  <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card className="p-12 text-center max-w-2xl mx-auto bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 backdrop-blur-sm border border-cyan-500/20">
            <HelpCircle className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Need Help?
            </h2>
            <p className="text-gray-400 mb-8">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <div className="flex justify-center space-x-4">
              <Button className="bg-white/[0.05] border border-cyan-500/30 text-white hover:bg-white/[0.1] hover:border-cyan-500/50 transition-all">
                Contact Support
              </Button>
              <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all">
                Join Community
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
