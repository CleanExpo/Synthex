import { Metadata } from 'next';
import AuthorityHubAnalytics from './AuthorityHubAnalytics';

// ISR: Revalidate every hour. Authority Hub pages carry LocalBusiness + VideoObject
// schema and must meet Core Web Vitals for Google's E.E.A.T. assessment.
// DO NOT remove these exports — see SYN-516 / SYN-512 for context.
export const revalidate = 3600;
export const dynamic = 'force-static';

interface ClientPageParams {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ClientPageParams): Promise<Metadata> {
  const { slug } = await params;
  const businessName = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    title: `${businessName} | Synthex Authority Hub`,
    description: `${businessName} — verified local business authority profile powered by Synthex AI marketing.`,
    openGraph: {
      title: `${businessName} | Synthex Authority Hub`,
      description: `AI-verified authority profile for ${businessName}.`,
      type: 'profile',
    },
  };
}

export default async function AuthorityHubPage({ params }: ClientPageParams) {
  const { slug } = await params;
  const businessName = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // Sprint 3 (SYN-512): Replace with full LocalBusiness schema + client data from Supabase.
  // This placeholder maintains ISR config from day 0 so Google's first crawl gets the
  // correct caching headers before the full implementation ships.
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <header className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-mono text-orange-400 tracking-widest uppercase bg-orange-400/10 border border-orange-400/20 rounded-full px-3 py-1">
                Synthex Authority Hub
              </span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">{businessName}</h1>
            <p className="text-slate-400 text-lg">Authority Profile · Powered by Synthex</p>
          </header>

          <section className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Authority Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { label: 'Authority Score', value: '—' },
                { label: 'E.E.A.T. Index', value: '—' },
                { label: 'Visibility Rank', value: '—' },
              ].map(metric => (
                <div key={metric.label} className="bg-slate-700/30 rounded-lg p-5">
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">{metric.label}</p>
                  <p className="text-3xl font-bold text-white">{metric.value}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-400 text-sm">
              Full brand intelligence and E.E.A.T. authority scoring launching in Sprint 3.
              This profile is indexed and revalidates hourly.
            </p>
          </section>
        </div>
      </div>

      <AuthorityHubAnalytics clientSlug={slug} />
    </main>
  );
}
