import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

// Landing page is static — cache at CDN for 1 hour, revalidate in background
export const revalidate = 3600;

import { NavBar } from '@/components/landing/nav-bar';
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorks } from '@/components/landing/how-it-works';
import { OrbitIntegrations } from '@/components/landing/orbit-integrations';
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

      {/* Social proof strip — trust signals immediately after hero */}
      <StatsSection />

      {/* How It Works — explain the value */}
      <HowItWorks />

      {/* Platform Integrations — which platforms are supported */}
      <OrbitIntegrations />

      {/* Testimonials — social proof before the ask */}
      <Testimonials />

      {/* FAQ — answer objections */}
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
