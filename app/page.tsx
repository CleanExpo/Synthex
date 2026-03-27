import type { Metadata } from 'next';
import { PAGE_METADATA } from '@/lib/seo/metadata';

// Landing page is static — cache at CDN for 1 hour, revalidate in background
export const revalidate = 3600;

import { CleanLightNav } from '@/components/landing/clean-light-nav';
import { CleanLightHero } from '@/components/landing/clean-light-hero';
import { CleanLightFeatures } from '@/components/landing/clean-light-features';
import { LogoBanner } from '@/components/landing/LogoBanner';
import { FooterSection } from '@/components/landing/footer-section';
import { buildFaqSchemaJson } from '@/lib/seo/faq-data';

export const metadata: Metadata = PAGE_METADATA.home;

const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Synthex',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: 'https://synthex.social',
  description:
    'AI-powered social media automation platform. Creates, schedules, and publishes platform-native content across 9 channels from a single dashboard.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'AUD',
    description: 'Free plan available — no credit card required',
  },
  featureList: [
    'AI content generation for 9 social media platforms',
    'Brand voice extraction from website URL',
    'Automated scheduling and publishing',
    'Real-time content scoring and analytics',
    'Multi-platform dashboard',
  ],
  applicationSubCategory: 'Social Media Management',
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Synthex',
  url: 'https://synthex.social',
  logo: 'https://synthex.social/synthex-logo.png',
  description:
    'AI-native social media automation for businesses across every industry.',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Brisbane',
    addressRegion: 'QLD',
    addressCountry: 'AU',
  },
  sameAs: [
    'https://www.instagram.com/synthex.social',
    'https://www.linkedin.com/company/synthex',
  ],
};

export default function HomePage() {
  return (
    <div className="bg-[#fafafa] min-h-screen text-neutral-900 font-sans selection:bg-[#ffd1dc]/40">
      <CleanLightNav />
      {/* FAQPage JSON-LD Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: buildFaqSchemaJson() }}
      />
      {/* SoftwareApplication schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppSchema) }}
      />
      {/* Organization schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      
      <main>
        <CleanLightHero />
        
        <div className="relative z-10 border-y border-neutral-200 bg-white/60 backdrop-blur-md opacity-90 overflow-hidden">
           {/* Subtle ambient light behind logos */}
           <div className="absolute inset-0 bg-[radial-gradient(circle,_#e0c3fc_0%,_transparent_100%)] opacity-10 pointer-events-none"></div>
           <LogoBanner />
        </div>
        
        <CleanLightFeatures />
        
        <div className="border-t border-neutral-200 bg-white shadow-[0_-10px_40px_rgba(0,0,0,0.02)]">
          <FooterSection />
        </div>
      </main>
    </div>
  );
}
