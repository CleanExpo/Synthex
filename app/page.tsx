import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';
import { NavBar } from '@/components/landing/nav-bar';
import { HeroSection } from '@/components/landing/hero-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { HowItWorks } from '@/components/landing/how-it-works';
import { VideoSection } from '@/components/landing/video-section';
import { StatsSection } from '@/components/landing/stats-section';
import { Testimonials } from '@/components/landing/testimonials';
import { FAQSection, buildFaqSchemaJson } from '@/components/landing/faq-section';
import { CTASection } from '@/components/landing/cta-section';
import { FooterSection } from '@/components/landing/footer-section';
import { FloatingParticles } from '@/components/landing/floating-particles';
import { LandingAnimations } from '@/components/landing/LandingAnimations';

export const metadata: Metadata = PAGE_METADATA.home;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a1628] text-white overflow-hidden">
      {/* FAQPage JSON-LD Schema -- hardcoded constants, no user input */}
      <script type="application/ld+json">{buildFaqSchemaJson()}</script>

      {/* Deep Navy Gradient Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#0a1628] via-[#0f172a] to-[#0a1628]" />

      {/* Subtle Grid Pattern */}
      <div className="fixed inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(6, 182, 212, 0.5) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(6, 182, 212, 0.5) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Floating Particles */}
      <FloatingParticles />

      {/* Glow Effects */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-cyan-400/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Navigation */}
      <NavBar />

      {/* Hero Section */}
      <HeroSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works Section */}
      <HowItWorks />

      {/* Video Explainer Section */}
      <VideoSection />

      {/* Stats Section */}
      <StatsSection />

      {/* Testimonials Section */}
      <Testimonials />

      {/* FAQ Section */}
      <FAQSection />

      {/* CTA Section */}
      <CTASection />

      {/* Footer */}
      <FooterSection />

      {/* GSAP landing page animations — no DOM output */}
      <LandingAnimations />

      {/* Global Styles */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.3;
          }
          50% {
            transform: translateY(-20px) translateX(-10px);
            opacity: 0.6;
          }
        }

        @keyframes disperse {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translate(-100px, -50px) scale(0);
            opacity: 0;
          }
        }

        .animate-float {
          animation: float 8s ease-in-out infinite;
        }

        .animate-disperse {
          animation: disperse 4s ease-out infinite;
        }
      `}</style>
    </div>
  );
}
