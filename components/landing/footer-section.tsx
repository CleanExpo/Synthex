import Link from 'next/link';

const FOOTER_LINKS = [
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
  { label: 'Cookies', href: '/privacy#cookies' },
  { label: 'Contact', href: '/contact' },
];

/** Simple dark footer — logo, 4 links, copyright */
export function FooterSection() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-900">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-6 h-6 bg-gradient-to-br from-[#ffb87b] to-[#ff8f00] rounded-sm flex items-center justify-center">
              <span className="text-[#2e1500] font-black text-[10px]">S</span>
            </div>
            <span className="text-white font-black tracking-[0.2em] text-xs uppercase">
              SYNTHEX
            </span>
          </Link>

          {/* Nav links */}
          <nav className="flex items-center gap-6">
            {FOOTER_LINKS.map(({ label, href }) => (
              <Link
                key={href}
                href={href}
                className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-white/60 transition-colors"
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Copyright */}
          <p className="font-mono text-[10px] text-white/20 uppercase tracking-wider text-right flex-shrink-0">
            © 2026 Synthex. High-Depth Intelligence.
          </p>
        </div>
      </div>
    </footer>
  );
}

export { FooterSection as Footer };
