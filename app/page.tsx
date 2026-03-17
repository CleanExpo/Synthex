import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

// Landing page is static — cache at CDN for 1 hour, revalidate in background
export const revalidate = 3600;

import { NavBar } from '@/components/landing/nav-bar';
import { HeroSection } from '@/components/landing/hero-section';
import { TextRevealByWord } from '@/components/landing/text-reveal';
import { FeaturesSection } from '@/components/landing/features-section';
import { HowItWorks } from '@/components/landing/how-it-works';
import { OrbitIntegrations } from '@/components/landing/orbit-integrations';
import { VideoSection } from '@/components/landing/video-section';
import InteractiveBentoGallery from '@/components/landing/bento-gallery';
import { StatsSection } from '@/components/landing/stats-section';
import { Testimonials } from '@/components/landing/testimonials';
import { FAQSection } from '@/components/landing/faq-section';
import { buildFaqSchemaJson } from '@/lib/seo/faq-data';
import { CTASection } from '@/components/landing/cta-section';
import { FooterSection } from '@/components/landing/footer-section';
import { FloatingParticles } from '@/components/landing/floating-particles';
import { LandingAnimations } from '@/components/landing/LandingAnimations';

export const metadata: Metadata = PAGE_METADATA.home;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a1628] text-white overflow-hidden">
      {/* FAQPage JSON-LD Schema */}
      <script type="application/ld+json">{buildFaqSchemaJson()}</script>

      {/* Deep navy background */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a1628] via-[#0d1b2e] to-[#0a1628]" />

      {/* Subtle grid */}
      <div
        className="fixed inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.4) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(6, 182, 212, 0.4) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />

      {/* Floating particles */}
      <FloatingParticles />

      {/* Single ambient glow — hero only */}
      <div className="fixed top-1/3 left-1/4 w-[500px] h-[500px] bg-cyan-500/[0.05] rounded-full blur-[180px] pointer-events-none" />

      {/* Navigation */}
      <NavBar />

      {/* Hero */}
      <HeroSection />

      {/* Tagline reveal — scroll-driven word-by-word animation */}
      <TextRevealByWord
        text="The AI platform that creates, schedules, and grows your social presence — automatically."
        className="relative z-10"
      />

      {/* Features */}
      <FeaturesSection />

      {/* Stats */}
      <StatsSection />

      {/* How It Works */}
      <HowItWorks />

      {/* Platform Integrations — animated orbit */}
      <OrbitIntegrations />

      {/* Video Explainer */}
      <VideoSection />

      {/* See It In Action — interactive bento gallery */}
      <section className="relative z-10 py-16">
        <InteractiveBentoGallery
          title="See It In Action"
          description="Explore how Synthex handles every part of your social media operation."
          mediaItems={[
            {
              id: 1,
              type: 'image',
              title: 'Content Calendar',
              desc: 'Visualise and manage every scheduled post across all your platforms in one unified calendar.',
              url: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=80',
              span: 'col-span-1 sm:col-span-2 row-span-2',
            },
            {
              id: 2,
              type: 'image',
              title: 'AI Writing Assistant',
              desc: 'Generate platform-optimised captions, hooks, and hashtags in seconds.',
              url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=80',
              span: 'col-span-1 sm:col-span-1 row-span-2',
            },
            {
              id: 3,
              type: 'image',
              title: 'Analytics Dashboard',
              desc: 'Track engagement, reach, and ROI across all connected platforms in real time.',
              url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',
              span: 'col-span-1 sm:col-span-1 row-span-2',
            },
            {
              id: 4,
              type: 'image',
              title: 'Post Scheduling',
              desc: 'Queue posts at optimal times determined by AI analysis of your audience behaviour.',
              url: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80',
              span: 'col-span-1 sm:col-span-2 row-span-2',
            },
            {
              id: 5,
              type: 'image',
              title: 'Team Collaboration',
              desc: 'Invite your team, assign roles, and review content with built-in approval workflows.',
              url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
              span: 'col-span-1 sm:col-span-1 row-span-2',
            },
            {
              id: 6,
              type: 'image',
              title: 'Platform Connections',
              desc: 'Connect Instagram, LinkedIn, X, TikTok, and 5 more platforms with a single click.',
              url: 'https://images.unsplash.com/photo-1432888498266-38ffec3eaf0a?w=800&q=80',
              span: 'col-span-1 sm:col-span-1 row-span-2',
            },
          ]}
        />
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* FAQ */}
      <FAQSection />

      {/* Final CTA */}
      <CTASection />

      {/* Footer */}
      <FooterSection />

      {/* GSAP landing page animations — no DOM output */}
      <LandingAnimations />
    </div>
  );
}
