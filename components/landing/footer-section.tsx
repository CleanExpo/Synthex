import Link from 'next/link';
import { SynthexLogo } from './synthex-logo';
import { footerLinkColumns } from '@/components/landing/premium/public-chrome-links';

/** Multi-column footer — product nav + company links + copyright */
export function FooterSection() {
  return (
    <footer className="border-t border-white/[0.04] bg-charcoal-950">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-4">
          <div>
            <Link href="/" className="mb-3 flex items-center gap-2">
              <SynthexLogo className="h-6 w-6" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white">
                SYNTHEX
              </span>
            </Link>
            <p className="max-w-[220px] text-[12px] leading-relaxed text-white/40">
              Evidence-backed marketing command center. Start with a free map.
            </p>
          </div>

          {footerLinkColumns.map(column => (
            <div key={column.title}>
              <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                {column.title}
              </p>
              <ul className="space-y-2.5">
                {column.links.map(link => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-[12px] text-white/50 transition-colors hover:text-orange-400"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/[0.04] pt-6 md:flex-row">
          <p className="text-[11px] text-white/30">
            © 2026 Synthex Pty Ltd · ABN: 62 580 077 456 · Brisbane, QLD,
            Australia
          </p>
          <p className="text-[11px] text-white/30">Controlled pilot access.</p>
        </div>
      </div>
    </footer>
  );
}

export { FooterSection as Footer };
