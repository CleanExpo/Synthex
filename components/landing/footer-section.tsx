import Link from 'next/link';
import { SynthexLogo } from './synthex-logo';

const PRODUCT_LINKS = [
  { label: 'Features', href: '/features' },
  { label: 'AI Content', href: '/features/ai-content' },
  { label: '9 Platforms', href: '/features/platforms' },
  { label: 'For Agencies', href: '/agencies' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'vs Hootsuite', href: '/compare/hootsuite' },
];

const COMPANY_LINKS = [
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Status', href: 'https://status.synthex.social', external: true },
];

/** Multi-column footer — product nav + company links + copyright */
export function FooterSection() {
  return (
    <footer className="bg-charcoal-950 border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Top row: logo + link columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">
          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3">
              <SynthexLogo className="w-6 h-6" />
              <span className="text-white font-black tracking-[0.2em] text-xs uppercase">
                SYNTHEX
              </span>
            </Link>
            <p className="text-[12px] text-white/40 leading-relaxed max-w-[220px]">
              AI-powered social media automation for businesses across every
              industry.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-4">
              Product
            </p>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="text-[12px] text-white/50 hover:text-orange-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/30 mb-4">
              Company
            </p>
            <ul className="space-y-2.5">
              {COMPANY_LINKS.map(({ label, href, external }) => (
                <li key={href}>
                  <Link
                    href={href}
                    target={external ? '_blank' : undefined}
                    rel={external ? 'noopener noreferrer' : undefined}
                    className="text-[12px] text-white/50 hover:text-orange-400 transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom row: legal */}
        <div className="border-t border-white/[0.04] pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-white/30">
            © 2026 Synthex Pty Ltd · ABN: 62 580 077 456 · Brisbane, QLD,
            Australia
          </p>
          <p className="text-[11px] text-white/30">AI-native social media.</p>
        </div>
      </div>
    </footer>
  );
}

export { FooterSection as Footer };
