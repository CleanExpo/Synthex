import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

// Landing page is static — cache at CDN for 1 hour, revalidate in background
export const revalidate = 3600;

import { NavBar } from '@/components/landing/nav-bar';
import { HeroSection } from '@/components/landing/hero-section';
import { StatsSection } from '@/components/landing/stats-section';
import { HowItWorks } from '@/components/landing/how-it-works';
import { IntelligenceSection } from '@/components/landing/intelligence-section';
import { Testimonials } from '@/components/landing/testimonials';
import { FAQSection } from '@/components/landing/faq-section';
import { buildFaqSchemaJson } from '@/lib/seo/faq-data';
import { UrlHealthCheck } from '@/components/landing/UrlHealthCheck';
import { CTASection } from '@/components/landing/cta-section';
import { EmailCaptureSection } from '@/components/landing/email-capture-section';
import { FooterSection } from '@/components/landing/footer-section';
import { LogoBanner } from '@/components/landing/LogoBanner';

export const metadata: Metadata = PAGE_METADATA.home;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-charcoal-900 text-white overflow-hidden">
      {/* FAQPage JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildFaqSchemaJson() }}
      />

      {/* Navigation */}
      <NavBar />

      {/* Hero */}
      <HeroSection />

      {/* Industry marquee — SMB social proof */}
      <LogoBanner />

      {/* Stats strip */}
      <StatsSection />

      {/* Deployment Pipeline */}
      <HowItWorks />

      {/* Free URL Health Check */}
      <UrlHealthCheck />

      {/* Unified Social Intelligence */}
      <IntelligenceSection />

      {/* Testimonial */}
      <Testimonials />

      {/* FAQ */}
      <FAQSection />

      {/* Final CTA */}
      <CTASection />

      {/* Newsletter / Email capture */}
      <EmailCaptureSection />

      {/* Footer */}
      <FooterSection />
    </div>
  );
}
