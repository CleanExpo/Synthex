'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import {
  ArrowRight, Code2, Lock, Zap, BookOpen,
  Key, Globe, Shield
} from '@/components/icons';

const apiEndpoints = [
  {
    category: 'Authentication',
    icon: Lock,
    endpoints: [
      { method: 'POST', path: '/api/auth/login', description: 'Authenticate user and receive access token' },
      { method: 'POST', path: '/api/auth/register', description: 'Create a new user account' },
      { method: 'POST', path: '/api/auth/refresh', description: 'Refresh access token' },
      { method: 'POST', path: '/api/auth/logout', description: 'Invalidate current session' },
    ]
  },
  {
    category: 'Content Generation',
    icon: Zap,
    endpoints: [
      { method: 'POST', path: '/api/ai-content/generate', description: 'Generate AI-powered social media content' },
      { method: 'POST', path: '/api/ai-content/optimize', description: 'Optimize existing content for engagement' },
      { method: 'POST', path: '/api/ai-content/translate', description: 'Translate content to target language' },
      { method: 'POST', path: '/api/ai-content/hashtags', description: 'Generate relevant hashtags' },
    ]
  },
  {
    category: 'Scheduling',
    icon: Globe,
    endpoints: [
      { method: 'GET', path: '/api/posts', description: 'List all scheduled posts' },
      { method: 'POST', path: '/api/posts', description: 'Create and schedule a new post' },
      { method: 'PUT', path: '/api/posts/:id', description: 'Update a scheduled post' },
      { method: 'DELETE', path: '/api/posts/:id', description: 'Delete a scheduled post' },
    ]
  },
  {
    category: 'Analytics',
    icon: Code2,
    endpoints: [
      { method: 'GET', path: '/api/analytics/overview', description: 'Get engagement overview metrics' },
      { method: 'GET', path: '/api/analytics/posts/:id', description: 'Get analytics for a specific post' },
      { method: 'GET', path: '/api/analytics/audience', description: 'Get audience demographics data' },
      { method: 'GET', path: '/api/analytics/trends', description: 'Get trending topics and patterns' },
    ]
  },
];

const features = [
  {
    icon: Key,
    title: 'API Keys',
    description: 'Secure authentication with rotating API keys and OAuth 2.0 support.'
  },
  {
    icon: Shield,
    title: 'Rate Limiting',
    description: 'Intelligent rate limiting with generous quotas for all plan tiers.'
  },
  {
    icon: Code2,
    title: 'SDKs',
    description: 'Official SDKs for JavaScript, Python, Ruby, and Go coming soon.'
  },
  {
    icon: BookOpen,
    title: 'Webhooks',
    description: 'Real-time event notifications for post status and analytics updates.'
  },
];

export default function ApiReferencePage() {
  return (
    <MarketingLayout currentPage="api-reference">
      {/* Hero Section */}
      <section className="pt-12 pb-16 px-6">
        <div className="container mx-auto text-center">
          <div className="inline-flex items-center bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-2 mb-6">
            <Code2 className="w-4 h-4 text-cyan-400 mr-2" />
            <span className="text-cyan-300 text-sm">Developer Resources</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">
            API <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300">Reference</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-3xl mx-auto">
            Build powerful integrations with the Synthex API. Access our AI-powered
            content generation, scheduling, and analytics capabilities programmatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/docs">
              <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-8 shadow-lg shadow-cyan-500/25">
                <BookOpen className="w-5 h-5 mr-2" />
                View Full Docs
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="lg" variant="outline" className="border-cyan-500/30 text-white hover:bg-cyan-500/10 px-8">
                Get API Key
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="pb-16 px-6">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="bg-[#0f172a]/60 backdrop-blur-xl border border-cyan-500/10 p-6 hover:border-cyan-500/30 transition-all">
                <feature.icon className="w-10 h-10 text-cyan-400 mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="py-20 px-6 bg-[#0f172a]/50 border-y border-cyan-500/10">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">API Endpoints</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Explore our RESTful API endpoints organized by functionality
          </p>

          <div className="space-y-8 max-w-4xl mx-auto">
            {apiEndpoints.map((category, index) => (
              <Card key={index} className="bg-[#0f172a]/60 backdrop-blur-xl border border-cyan-500/10 overflow-hidden">
                <div className="flex items-center gap-3 px-6 py-4 border-b border-cyan-500/10 bg-cyan-500/5">
                  <category.icon className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-semibold text-white">{category.category}</h3>
                </div>
                <div className="divide-y divide-cyan-500/10">
                  {category.endpoints.map((endpoint, idx) => (
                    <div key={idx} className="px-6 py-4 hover:bg-cyan-500/5 transition-colors">
                      <div className="flex items-start gap-4">
                        <span className={`px-2 py-1 text-xs font-mono rounded ${
                          endpoint.method === 'GET' ? 'bg-emerald-500/20 text-emerald-400' :
                          endpoint.method === 'POST' ? 'bg-cyan-500/20 text-cyan-400' :
                          endpoint.method === 'PUT' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {endpoint.method}
                        </span>
                        <div className="flex-1">
                          <code className="text-white font-mono text-sm">{endpoint.path}</code>
                          <p className="text-gray-500 text-sm mt-1">{endpoint.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Code Example */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center text-white mb-4">Quick Start</h2>
          <p className="text-gray-500 text-center mb-12 max-w-2xl mx-auto">
            Get started with the Synthex API in minutes
          </p>

          <div className="max-w-3xl mx-auto">
            <Card className="bg-[#0f172a]/80 backdrop-blur-xl border border-cyan-500/10 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-cyan-500/10 bg-cyan-500/5">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-4 text-gray-500 text-sm font-mono">generate-content.js</span>
              </div>
              <pre className="p-6 text-sm overflow-x-auto">
                <code className="text-gray-300">
{`// Generate AI-powered content
const response = await fetch('https://api.synthex.social/ai-content/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    prompt: 'Launch announcement for new feature',
    platform: 'twitter',
    tone: 'professional',
    includeHashtags: true,
  }),
});

const { content, hashtags } = await response.json();
console.log(content);
// "We're thrilled to announce our latest feature! 🚀 ..."
`}
                </code>
              </pre>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="container mx-auto">
          <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 backdrop-blur-xl border border-cyan-500/20 rounded-2xl p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Build?
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Get your API key and start building powerful integrations with Synthex.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup">
                <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white px-10 shadow-lg shadow-cyan-500/25">
                  Get API Key
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" className="border-cyan-500/30 text-white hover:bg-cyan-500/10 px-10">
                  Read Documentation
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
