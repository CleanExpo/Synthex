'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mail, Edit3 } from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

export default function BlogPage() {
  return (
    <MarketingLayout currentPage="blog">
      {/* Hero Section */}
      <section className="pt-12 pb-12 px-6">
        <div className="container mx-auto text-center">
          <Edit3 className="w-16 h-16 text-orange-400 mx-auto mb-6" />
          <h1 className="text-5xl font-bold text-white mb-4">
            Synthex{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-300">
              Blog
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Insights, strategies, and updates from the world of AI-powered
            social media marketing
          </p>
        </div>
      </section>

      {/* Coming Soon */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          <Card className="bg-surface-base/80 backdrop-blur-md border border-orange-500/20 p-16 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6">
              <Edit3 className="w-7 h-7 text-orange-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">
              First article coming soon
            </h2>
            <p className="text-gray-400 mb-8">
              We&apos;re crafting in-depth guides on AI-powered social media
              marketing. Subscribe to be notified when we publish.
            </p>
            <form
              className="flex gap-2 max-w-sm mx-auto"
              onSubmit={e => e.preventDefault()}
            >
              <input
                type="email"
                placeholder="your@email.com"
                className="flex-1 px-4 py-3 bg-surface-dark/80 border border-orange-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-400/50 transition-colors text-sm"
              />
              <Button
                type="submit"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25"
              >
                <Mail className="w-4 h-4 mr-2" />
                Notify me
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </MarketingLayout>
  );
}
