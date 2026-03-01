'use client';

import { Bot, Zap, BarChart3, Globe } from '@/components/icons';

const FEATURES = [
  { icon: Bot, title: 'AI Content Creation', desc: 'Generate engaging posts, captions, and visuals automatically' },
  { icon: Zap, title: 'Smart Scheduling', desc: 'AI determines optimal posting times for maximum engagement' },
  { icon: BarChart3, title: 'Performance Analytics', desc: 'Real-time insights and AI-powered recommendations' },
  { icon: Globe, title: 'Multi-Platform', desc: 'Manage all your social accounts from one dashboard' },
];

/** Landing page features grid section */
export function FeaturesSection() {
  return (
    <section className="relative py-32 z-10">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-20">
          <span className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium mb-6">
            Powered by AI
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Everything you need to <span className="text-cyan-400">dominate</span> social
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Our AI handles every aspect of your social media marketing, from content creation to performance optimization.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((feature, i) => (
            <div
              key={i}
              className="group p-8 bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl hover:border-cyan-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-cyan-500/20 transition-colors">
                <feature.icon className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
