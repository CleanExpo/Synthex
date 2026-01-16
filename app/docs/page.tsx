import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Sparkles, BookOpen, Code, Zap, Users, 
  Settings, Shield, HelpCircle, ArrowRight 
} from '@/components/icons';

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/[0.02] backdrop-blur-xl border-b border-white/[0.08]">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold gradient-text">Synthex</span>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/features" className="text-gray-300 hover:text-white transition">
                Features
              </Link>
              <Link href="/pricing" className="text-gray-300 hover:text-white transition">
                Pricing
              </Link>
              <Link href="/docs" className="text-white">
                Docs
              </Link>
              <Link href="/signup">
                <Button className="gradient-primary text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-6">
              Documentation
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Everything you need to know about using Synthex to grow your social media presence
            </p>
          </div>

          {/* Documentation Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <Zap className="w-10 h-10 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Getting Started</h3>
              <p className="text-gray-400 mb-4">
                Quick setup guide to get you running in minutes
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Account setup</li>
                <li>• Connecting social accounts</li>
                <li>• First AI persona</li>
                <li>• Your first post</li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <BookOpen className="w-10 h-10 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">User Guide</h3>
              <p className="text-gray-400 mb-4">
                Comprehensive guide to all features
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Persona training</li>
                <li>• Content generation</li>
                <li>• Scheduling posts</li>
                <li>• Analytics dashboard</li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <Code className="w-10 h-10 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">API Reference</h3>
              <p className="text-gray-400 mb-4">
                Developer documentation for integrations
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Authentication</li>
                <li>• Endpoints</li>
                <li>• Rate limits</li>
                <li>• Webhooks</li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <Settings className="w-10 h-10 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Advanced Features</h3>
              <p className="text-gray-400 mb-4">
                Master the advanced capabilities
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Custom AI training</li>
                <li>• Viral pattern analysis</li>
                <li>• A/B testing</li>
                <li>• Automation workflows</li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <Users className="w-10 h-10 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Team Collaboration</h3>
              <p className="text-gray-400 mb-4">
                Working with teams and agencies
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• User roles</li>
                <li>• Approval workflows</li>
                <li>• Client management</li>
                <li>• White-label options</li>
              </ul>
            </Card>

            <Card variant="glass" className="p-6 hover:scale-105 transition-transform cursor-pointer">
              <Shield className="w-10 h-10 text-purple-500 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Security & Privacy</h3>
              <p className="text-gray-400 mb-4">
                How we protect your data
              </p>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Data encryption</li>
                <li>• Privacy policy</li>
                <li>• GDPR compliance</li>
                <li>• Security best practices</li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Popular Articles */}
      <section className="py-20 px-6 bg-white/[0.02] backdrop-blur-xl border-y border-white/[0.08]">
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
              <Card key={article} variant="glass" className="p-4 hover:bg-white/10 transition cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="text-white">{article}</span>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <Card variant="glass-primary" className="p-12 text-center max-w-2xl mx-auto">
            <HelpCircle className="w-16 h-16 text-purple-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Need Help?
            </h2>
            <p className="text-gray-300 mb-8">
              Can't find what you're looking for? Our support team is here to help.
            </p>
            <div className="flex justify-center space-x-4">
              <Button className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
                Contact Support
              </Button>
              <Button className="gradient-primary text-white">
                Join Community
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}