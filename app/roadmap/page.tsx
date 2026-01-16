import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sparkles, CheckCircle, Circle, Clock, Rocket, Zap, Brain, Shield, Globe, Users } from '@/components/icons';

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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <nav className="fixed top-0 w-full z-50 glass-card border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold gradient-text">Synthex</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>
      
      <div className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-6">Product Roadmap</h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Our commitment to continuous innovation and delivering the most advanced AI-powered social media platform
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {quarters.map((quarter, idx) => (
              <Card key={idx} className={`glass-card p-6 ${
                quarter.status === 'completed' ? 'border-green-500/50' :
                quarter.status === 'in-progress' ? 'border-purple-500/50 animate-pulse-glow' :
                'border-white/10'
              }`}>
                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{quarter.name}</h3>
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
                    quarter.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    quarter.status === 'in-progress' ? 'bg-purple-500/20 text-purple-400' :
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
                          item.status === 'completed' ? 'text-green-500' :
                          item.status === 'in-progress' ? 'text-purple-500' :
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
                          item.status === 'completed' ? 'text-green-500' :
                          item.status === 'in-progress' ? 'text-purple-500' :
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
            <Card className="glass-card p-8 text-center">
              <h2 className="text-3xl font-bold text-white mb-4">Have a Feature Request?</h2>
              <p className="text-gray-300 mb-6">
                We're always looking for ways to improve Synthex. Share your ideas and help shape the future of our platform.
              </p>
              <Link href="/signup">
                <Button className="gradient-primary text-white">
                  Submit Feature Request
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}