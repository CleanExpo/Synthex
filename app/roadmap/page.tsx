'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CheckCircle, Circle, Clock, Rocket, Zap, Brain, Shield, Globe, Users, Sparkles } from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

const quarters = [
  {
    name: 'Q1 2025',
    status: 'completed',
    items: [
      { title: 'AI Persona Learning', status: 'completed', icon: Brain },
      { title: 'Multi-Platform Support', status: 'completed', icon: Globe },
      { title: 'Basic Analytics Dashboard', status: 'completed', icon: Zap },
      { title: 'Content Generation v1', status: 'completed', icon: Sparkles },
    ]
  },
  {
    name: 'Q2 2025',
    status: 'in-progress',
    items: [
      { title: 'Advanced Viral Pattern Analysis', status: 'completed', icon: Rocket },
      { title: 'Smart Scheduling Algorithm', status: 'in-progress', icon: Clock },
      { title: 'A/B Testing Framework', status: 'in-progress', icon: Zap },
      { title: 'Team Collaboration Features', status: 'planned', icon: Users },
    ]
  },
  {
    name: 'Q3 2025',
    status: 'planned',
    items: [
      { title: 'AI Video Content Generation', status: 'planned', icon: Sparkles },
      { title: 'Advanced Competitor Analysis', status: 'planned', icon: Brain },
      { title: 'Custom AI Model Training', status: 'planned', icon: Rocket },
      { title: 'Enterprise Security Features', status: 'planned', icon: Shield },
    ]
  },
  {
    name: 'Q4 2025',
    status: 'planned',
    items: [
      { title: 'White-Label Solution', status: 'planned', icon: Globe },
      { title: 'API v2 with Webhooks', status: 'planned', icon: Zap },
      { title: 'Advanced Automation Workflows', status: 'planned', icon: Brain },
      { title: 'Mobile App Launch', status: 'planned', icon: Rocket },
    ]
  }
];

export default function RoadmapPage() {
  return (
    <MarketingLayout currentPage="roadmap">
      <div className="pt-12 pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-6">Product <span className="bg-gradient-to-r from-cyan-400 to-cyan-500 bg-clip-text text-transparent">Roadmap</span></h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Our commitment to continuous innovation and delivering the most advanced AI-powered social media platform
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {quarters.map((quarter, idx) => (
              <Card key={idx} className={`bg-surface-base/80 p-6 ${
                quarter.status === 'completed' ? 'border-cyan-500/50' :
                quarter.status === 'in-progress' ? 'border-cyan-400/50 animate-pulse-glow' :
                'border-cyan-500/10'
              }`}>
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{quarter.name}</h3>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
                    quarter.status === 'completed' ? 'bg-cyan-500/20 text-cyan-400' :
                    quarter.status === 'in-progress' ? 'bg-cyan-400/20 text-cyan-300' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {quarter.status === 'completed' ? 'Completed' :
                     quarter.status === 'in-progress' ? 'In Progress' : 'Planned'}
                  </div>
                </div>

                <div className="space-y-4">
                  {quarter.items.map((item, itemIdx) => {
                    const Icon = item.icon;
                    return (
                      <div key={itemIdx} className="flex items-start space-x-3">
                        <div className={`mt-1 ${
                          item.status === 'completed' ? 'text-cyan-500' :
                          item.status === 'in-progress' ? 'text-cyan-400' :
                          'text-gray-500'
                        }`}>
                          {item.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5" />
                          ) : item.status === 'in-progress' ? (
                            <Clock className="w-5 h-5 animate-spin" />
                          ) : (
                            <Circle className="w-5 h-5" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm ${
                            item.status === 'completed' ? 'text-white' :
                            item.status === 'in-progress' ? 'text-white' :
                            'text-gray-400'
                          }`}>
                            {item.title}
                          </p>
                        </div>
                        <Icon className={`w-4 h-4 ${
                          item.status === 'completed' ? 'text-cyan-500' :
                          item.status === 'in-progress' ? 'text-cyan-400' :
                          'text-gray-500'
                        }`} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-16">
            <Card className="bg-surface-base/80 border-cyan-500/10 p-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Have a Feature Request?</h2>
              <p className="text-gray-300 mb-6">
                We're always looking for ways to improve Synthex. Share your ideas and help shape the future of our platform.
              </p>
              <Link href="/signup">
                <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
                  Submit Feature Request
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}
