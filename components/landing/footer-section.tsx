import Link from 'next/link';

const FOOTER_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Cookies', href: '/privacy#cookies' },
  { label: 'Contact', href: '/contact' },
  { label: 'Status', href: 'https://status.synthex.social', external: true },
];

/** Simple footer — warm charcoal bg, amber link hovers */
export function FooterSection() {
  return (
    <footer className="bg-charcoal-950 border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-charcoal-900 font-black text-[10px]">
                S
              </span>
            </div>
            <span className="text-white font-black tracking-[0.2em] text-xs uppercase">
              SYNTHEX
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-6">
            {FOOTER_LINKS.map(({ label, href, external }) => (
              <Link
                key={href}
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
                className="text-[11px] font-medium text-white/50 hover:text-orange-400 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <div className="flex-shrink-0 text-center md:text-right">
            <p className="text-[11px] text-white/50">
              © 2026 Synthex. AI-native social media.
            </p>
            <p className="text-[11px] text-white/30 mt-1">
              Synthex Pty Ltd · ABN: [ABN REQUIRED] · Brisbane, QLD, Australia
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export { FooterSection as Footer };
