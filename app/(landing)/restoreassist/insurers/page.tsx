import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  FileSearch,
  FileText,
  Layers,
  Repeat,
  Scale,
  Shield,
} from '@/components/icons';

/*
 * ============================================================================
 * SYN-918 — Insurer-facing landing page for RestoreAssist
 * ----------------------------------------------------------------------------
 * COPY STATUS: All prose on this page is AUTHORED PLACEHOLDER pending marketing
 * sign-off. The Linear ticket supplied the section structure and a small set of
 * factual claims (50+ contractor report formats, a 20–30% re-inspection rate,
 * an IICRC-grounded standard called "NIR", a 5-step flow, and three insurer
 * benefits) but NO verbatim marketing copy. Every sentence below is written to
 * the RestoreAssist brand voice (packages/brand-config/src/brands/ra.ts) as a
 * starting draft. Sections that need explicit confirmation are marked inline
 * with:  {/* COPY: pending marketing sign-off *\/}
 *
 * BRAND TOKENS: This page deliberately uses the CURRENT locked RestoreAssist
 * palette (navy #1C2E47 / warm earth #8A6B4E / light tan #D4A574) from
 * packages/brand-config/src/brands/ra.design.md + ra.ts — NOT the candy-orange
 * palette (#E55A2B / #2A3D45 / #C5E063) named in the SYN-918 description. The
 * ra.ts header documents that the candy-orange palette was SUPERSEDED on
 * 2026-05-15 by the navy identity (CLAUDE.md rule 17, Wave 1 launch brief),
 * which post-dates this ticket. The ticket itself names ra.design.md as the
 * token source of truth, and that file locks navy. This conflict is flagged in
 * the PR for owner resolution. No Synthex tokens are used.
 *
 * PENDING ASSETS (do not ship as final without these):
 *   - Hero explainer video MP4 (SYN-915f) — /restoreassist/nir-explainer.mp4
 *   - App Store badge artwork + live store URL (RA-1842 iOS release)
 *   - "NIR" acronym full expansion — describe functionally until confirmed
 * ============================================================================
 */

export const metadata: Metadata = {
  title: 'RestoreAssist for Insurers | One report format across your network',
  description:
    'Insurance claims teams read 50+ contractor report formats a week. RestoreAssist gives every contractor one IICRC-grounded inspection report — fewer re-inspections, shorter claim cycles, a clean audit trail.',
  alternates: { canonical: '/restoreassist/insurers' },
  openGraph: {
    title: 'RestoreAssist for Insurers — one report format across your network',
    description:
      'One IICRC-grounded inspection report across your whole contractor network. Fewer re-inspections, shorter claim cycles, a defensible audit trail.',
    url: '/restoreassist/insurers',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

// RestoreAssist locked palette, referenced as CSS custom properties defined on
// the scoped .ra-insurers-page class in app/globals.css. Using var(--ra-*)
// tokens — not raw hex — keeps every colour traceable to a brand token and
// satisfies the repo no-raw-hex rule.
// Where "Book a walkthrough" sends an insurer.
//
// This used to be the internal route `/demo`, which is the SYNTHEX social-media
// caption generator — an insurance claims team clicking the only CTA on a
// RestoreAssist page landed on a different product entirely. RestoreAssist has
// no demo-booking URL (restoreassist.app/demo does not exist), so the enquiry
// goes to its real contact page, which carries a message form and staffed
// office hours. Verified live 06/08/2026.
const WALKTHROUGH_URL =
  'https://restoreassist.app/contact?utm_source=synthex&utm_medium=referral&utm_campaign=ra_insurers&utm_content=walkthrough';

const RA = {
  navy: 'var(--ra-navy)', // primary
  earth: 'var(--ra-earth)', // secondary
  tan: 'var(--ra-tan)', // accent — CTAs / action moments only
  n50: 'var(--ra-n50)',
  n100: 'var(--ra-n100)',
  n500: 'var(--ra-n500)',
  n900: 'var(--ra-n900)',
  navyChip: 'var(--ra-navy-chip)',
  white: 'var(--ra-white)',
} as const;

// {/* COPY: pending marketing sign-off — figures supplied by the ticket still
//     need verification against a real contractor-network sample */}
const fragmentationStats = [
  {
    icon: Layers,
    value: '50+',
    label: 'report formats',
    note: 'across a typical contractor network — every trade files its own way',
  },
  {
    icon: Repeat,
    value: '20–30%',
    label: 'of claims re-inspected',
    note: 'when a report is missing readings, photos, or a clear moisture map',
  },
  {
    icon: Clock,
    value: 'Days',
    label: 'added per claim',
    note: 'each send-back for a second inspection stretches the claim cycle',
  },
];

// {/* COPY: pending marketing sign-off — the five steps are an authored draft;
//     confirm the real product flow with the RestoreAssist team */}
const flowSteps = [
  {
    icon: Camera,
    title: 'Capture',
    body: 'The contractor records the site on the RestoreAssist app — photos, moisture readings, and affected materials, on the spot.',
  },
  {
    icon: Layers,
    title: 'Structure',
    body: 'The app sorts each finding into the standard report sections, so nothing is left to memory or a blank template.',
  },
  {
    icon: FileSearch,
    title: 'Map to the standard',
    body: 'Every finding is tagged to its IICRC section — the industry rulebook for water-damage inspection — so the reasoning is on the page.',
  },
  {
    icon: CheckCircle2,
    title: 'Review',
    body: 'The contractor confirms readings and the moisture map before anything is filed, catching gaps while still on site.',
  },
  {
    icon: FileText,
    title: 'File',
    body: 'The finished report reaches your claims desk in one format — the same layout, section by section, from every contractor.',
  },
];

// {/* COPY: pending marketing sign-off */}
const benefits = [
  {
    icon: Clock,
    title: 'Shorter claim cycles',
    body: 'One report your team can read at a glance means fewer send-backs and less time chasing missing detail.',
  },
  {
    icon: Shield,
    title: 'A full audit trail',
    body: 'Every reading, photo, and timestamp is on the record — so a decision made today still stands up when the file is reopened.',
  },
  {
    icon: Scale,
    title: 'Defensible in a dispute',
    body: 'Findings are tied to the IICRC inspection standard, giving your assessors a grounded basis when a claim is challenged.',
  },
];

export default function InsurersLandingPage() {
  return (
    <main
      className="ra-insurers-page font-sans"
      style={{ backgroundColor: RA.n50, color: RA.navy }}
    >
      {/* ================= 1 · HERO ================= */}
      {/* {/* COPY: pending marketing sign-off — opens on the adjuster's problem,
          not the brand, per RA voice rule */}
      <section
        style={{ backgroundColor: RA.navy, color: RA.n50 }}
        className="px-6 py-20 sm:py-28"
      >
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <p
              className="font-mono text-xs uppercase tracking-widest"
              style={{ color: RA.tan }}
            >
              For insurance claims teams
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] sm:text-5xl">
              Fifty contractor reports a week. Fifty different formats. One
              re-inspection after another.
            </h1>
            <p
              className="mt-6 max-w-xl text-lg leading-relaxed"
              style={{ color: RA.n100 }}
            >
              RestoreAssist gives every contractor in your network one
              IICRC-grounded inspection report — built to the same industry
              standard every time — so a water-damage claim reads the same
              whether it comes from Cairns or Perth.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href={WALKTHROUGH_URL}
                className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold transition-opacity hover:opacity-90"
                style={{ backgroundColor: RA.tan, color: RA.navy }}
              >
                Book a walkthrough
                <ArrowRight className="h-5 w-5" />
              </a>
              {/* {/* COPY: pending real App Store badge artwork + live store URL
                  (RA-1842). Placeholder link styled to spec until then. */}
              <a
                href="#"
                aria-label="Download RestoreAssist on the App Store (link pending)"
                className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium"
                style={{ borderColor: RA.earth, color: RA.n50 }}
              >
                Download on the App Store
                <span className="font-mono text-xs opacity-70">(pending)</span>
              </a>
            </div>
          </div>

          {/* Hero explainer video — 90s NIR explainer (SYN-915f). Asset not yet
              produced; renders a graceful poster placeholder until the MP4 exists. */}
          <div
            className="relative aspect-video w-full overflow-hidden rounded-xl border"
            style={{ borderColor: RA.earth, backgroundColor: RA.n900 }}
          >
            <video
              className="h-full w-full object-cover"
              controls
              preload="none"
              poster="/marketing-agency/restoreassist-authority/assets/restoreassist-report-readiness-diorama.webp"
            >
              {/* {/* COPY/ASSET: pending SYN-915f 90s NIR explainer MP4 */}
              <source src="/restoreassist/nir-explainer.mp4" type="video/mp4" />
              Your browser does not support embedded video. The RestoreAssist
              explainer walks through one claim, end to end.
            </video>
          </div>
        </div>
      </section>

      {/* ================= 2 · THE FRAGMENTATION PROBLEM ================= */}
      <section className="px-6 py-20" style={{ backgroundColor: RA.n50 }}>
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6" style={{ color: RA.earth }} />
            <h2 className="text-3xl font-extrabold sm:text-4xl">
              Every contractor reports differently. Your team pays for it.
            </h2>
          </div>
          {/* {/* COPY: pending marketing sign-off */}
          <p
            className="mt-5 max-w-3xl text-lg leading-relaxed"
            style={{ color: RA.n500 }}
          >
            When each trade files its own layout, an adjuster reads fifty
            versions of the same job. A missing moisture reading or an
            unlabelled photo sends the claim back for a second inspection — and
            the cycle starts again.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {fragmentationStats.map(stat => (
              <div
                key={stat.label}
                className="rounded-xl border p-6"
                style={{ backgroundColor: RA.white, borderColor: RA.n100 }}
              >
                <stat.icon className="h-7 w-7" style={{ color: RA.earth }} />
                <p
                  className="mt-4 text-4xl font-extrabold"
                  style={{ color: RA.navy }}
                >
                  {stat.value}
                </p>
                <p className="mt-1 text-base font-semibold">{stat.label}</p>
                <p className="mt-2 text-sm" style={{ color: RA.n500 }}>
                  {stat.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 3 · NIR — THE STANDARD ================= */}
      <section
        className="px-6 py-20"
        style={{ backgroundColor: RA.navy, color: RA.n50 }}
      >
        <div className="mx-auto max-w-6xl">
          <p
            className="font-mono text-xs uppercase tracking-widest"
            style={{ color: RA.tan }}
          >
            The standard
          </p>
          <h2 className="mt-4 max-w-3xl text-3xl font-extrabold sm:text-4xl">
            The NIR — one report format, filed the same way every time.
          </h2>
          {/* {/* COPY: pending marketing sign-off — "NIR" is described
              functionally because its full expansion is not yet confirmed */}
          <p
            className="mt-5 max-w-3xl text-lg leading-relaxed"
            style={{ color: RA.n100 }}
          >
            The NIR is a single inspection report — one layout, the same
            sections in the same order, from every contractor. RestoreAssist
            ties each finding to its IICRC section, the industry rulebook that
            says how a water-damage inspection should be done, so your assessors
            see the reasoning, not just the result.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            {/* {/* COPY: pending marketing sign-off — confirm which IICRC
                sections RestoreAssist maps to */}
            {[
              'IICRC S500 · water',
              'IICRC S520 · mould',
              'Moisture map',
              'Photo log',
            ].map(chip => (
              <span
                key={chip}
                className="rounded font-mono text-sm"
                style={{
                  backgroundColor: RA.navyChip,
                  color: RA.tan,
                  padding: '6px 10px',
                }}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 4 · THE 5-STEP FLOW ================= */}
      <section className="px-6 py-20" style={{ backgroundColor: RA.n50 }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            One claim, five steps, the same report at the end.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-5">
            {flowSteps.map((step, i) => (
              <div key={step.title} className="relative">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full"
                  style={{ backgroundColor: RA.navy, color: RA.tan }}
                >
                  <step.icon className="h-5 w-5" />
                </div>
                <p
                  className="mt-4 font-mono text-xs"
                  style={{ color: RA.n500 }}
                >
                  Step {i + 1}
                </p>
                <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: RA.n500 }}
                >
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 5 · INSURER BENEFITS ================= */}
      <section className="px-6 py-20" style={{ backgroundColor: RA.white }}>
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            What a single report format gives your claims desk.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {benefits.map(b => (
              <div
                key={b.title}
                className="rounded-xl border p-7"
                style={{ backgroundColor: RA.n50, borderColor: RA.n100 }}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-lg"
                  style={{ backgroundColor: RA.navy, color: RA.tan }}
                >
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-bold">{b.title}</h3>
                <p
                  className="mt-2 text-base leading-relaxed"
                  style={{ color: RA.n500 }}
                >
                  {b.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 6 · DEMO BOOKING CTA ================= */}
      <section
        className="px-6 py-20"
        style={{ backgroundColor: RA.navy, color: RA.n50 }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-extrabold sm:text-4xl">
            See a claim move through RestoreAssist, end to end.
          </h2>
          {/* {/* COPY: pending marketing sign-off */}
          <p
            className="mt-5 text-lg leading-relaxed"
            style={{ color: RA.n100 }}
          >
            Book a walkthrough and watch one water-damage claim go from the site
            photo to a filed report your team can read without a second
            inspection.
          </p>
          <div className="mt-9 flex justify-center">
            <a
              href={WALKTHROUGH_URL}
              className="inline-flex items-center gap-2 rounded-lg px-8 py-4 text-base font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: RA.tan, color: RA.navy }}
            >
              Book a walkthrough
              <ArrowRight className="h-5 w-5" />
            </a>
          </div>
          {/*
           * Cross-link to the pricing page. Both RestoreAssist pages were
           * reachable only by direct URL — nothing on the site linked to
           * either. Kept as a plain text link rather than a second button so
           * it does not compete with the walkthrough CTA above, and the price
           * itself is deliberately not repeated here so the two pages cannot
           * drift apart.
           */}
          <p
            className="mt-6 text-sm leading-relaxed"
            style={{ color: RA.n100 }}
          >
            Contractors on your network pay a flat monthly rate.{' '}
            <Link
              href="/restoreassist/pricing"
              className="underline underline-offset-4 hover:opacity-80"
            >
              See what RestoreAssist costs
            </Link>
            .
          </p>
          <p className="mt-8 font-mono text-xs" style={{ color: RA.n500 }}>
            Built in Brisbane for Australian restoration work.
          </p>
        </div>
      </section>
    </main>
  );
}
