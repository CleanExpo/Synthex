import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Sparkles,
  Shield,
  Zap,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { SafetyStrip, SiteShell } from '@/components/landing/public-v2';

export const metadata: Metadata = {
  title: 'MCP App Development — Add-On | Synthex',
  description:
    'Synthex builds and operates your business as an interactive MCP App inside Claude and ChatGPT. Powered by Alpic Skybridge, deployed to the Claude + ChatGPT app stores. Add-on service.',
  openGraph: {
    title: 'MCP App Development — Add-On | Synthex',
    description:
      'Build your business as an MCP App inside Claude + ChatGPT. Powered by Alpic Skybridge. Synthex Add-On.',
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Tier copy — see /contact for actual scoping; numbers below are indicative
// only and a real quote follows the discovery call. Updated 2026-05-25.
// ────────────────────────────────────────────────────────────────────────────

const deliveryTiers = [
  {
    name: 'Discovery + Spec',
    indicative: 'From AUD 2,500 (one-off)',
    timeframe: '1–2 weeks',
    copy: 'We run the Skybridge phased discovery workflow against your business. You get a locked SPEC.md, UX flow, and a concrete go/no-go decision before any code is written.',
    inclusions: [
      'Discovery sessions covering value-prop, "why LLM", UI overview, product context',
      'SPEC.md authored and reviewed with you',
      'Architecture sketch + auth integration choice (Clerk / WorkOS / Stytch / Auth0)',
      'Cost model: framework (free) vs hosting (Alpic or self-host) vs ongoing ops',
      'Go/no-go recommendation — no obligation to proceed to build',
    ],
  },
  {
    name: 'Build + Launch',
    indicative: 'Scoped from discovery — typical AUD 12,000–35,000',
    timeframe: '3–8 weeks from locked spec',
    copy: 'Full Skybridge MCP App built against the spec. Production-grade tool handlers, type-safe React views, OAuth where needed, deployed on Alpic (or self-hosted) and submitted to the Claude + ChatGPT app stores.',
    inclusions: [
      'Skybridge project scaffold + repo handover (you own the code)',
      'Tool handlers wired to your existing APIs',
      'Type-safe React views per the Skybridge UI guidelines',
      'Auth integration (OAuth via your chosen provider)',
      'Alpic deployment OR self-host on your existing Node.js platform',
      'Submission package for the Claude and ChatGPT app stores',
      'Source-of-truth SPEC.md kept current through delivery',
    ],
  },
  {
    name: 'Operate + Evolve',
    indicative: 'From AUD 1,200/month (recurring)',
    timeframe: 'Ongoing',
    copy: 'We host, monitor, iterate, and re-submit as the platforms evolve. Includes responding to MCP-store policy changes, Skybridge framework upgrades, and quarterly UX iteration.',
    inclusions: [
      'Alpic-managed hosting + analytics (MCP clients, sessions, tool calls, user intent)',
      'Quarterly UX iteration cycle (review + ship)',
      'MCP-store policy monitoring + re-submission as needed',
      'Skybridge framework upgrades (locked-version policy)',
      'Incident response (Synthex business hours, AEST)',
      'Optional: tenant-scoped multi-customer mode for resellable derivatives',
    ],
  },
];

const whyThis = [
  {
    icon: Sparkles,
    title: 'Be where the users are',
    copy: 'AI Overviews answer 60%+ of US search queries and CTR drops up to 65% where they appear. Your business needs to live inside the AI assistant, not on the other side of a click.',
  },
  {
    icon: Zap,
    title: 'Skybridge does the heavy lifting',
    copy: 'Alpic\'s Skybridge framework (MIT-licensed, v1.0 released May 2026) powers ~10% of all apps on the Claude + ChatGPT stores. Used by Datadog, Bitmovin, Evaneos. We build on the same stack.',
  },
  {
    icon: Shield,
    title: 'You own the code',
    copy: 'Repo handover at end of Build. Self-host fallback always available — no vendor lock-in to Alpic\'s managed plane. MIT framework + your choice of hosting.',
  },
];

const costModel = [
  {
    layer: 'Skybridge framework',
    cost: 'Free (MIT-licensed open source)',
    note: 'No licence fees. Maintained by Alpic AI (France).',
    link: 'https://github.com/alpic-ai/skybridge',
    linkLabel: 'github.com/alpic-ai/skybridge',
  },
  {
    layer: 'Alpic hosting (optional)',
    cost: 'Quoted per app — pricing on application',
    note: 'Includes MCP-specific analytics, app-store compliance auditing, permanent tunnelling. Self-host alternative on any Node.js platform.',
    link: 'https://alpic.ai',
    linkLabel: 'alpic.ai',
  },
  {
    layer: 'Auth provider (if needed)',
    cost: 'Provider-dependent — typically free tier covers low volume',
    note: 'Clerk (multi-tenant SaaS), WorkOS (B2B + SCIM), Stytch (passwordless), Auth0 (enterprise). Synthex picks the right fit per business model.',
    link: null,
    linkLabel: null,
  },
  {
    layer: 'Synthex delivery',
    cost: 'See tiers above',
    note: 'Discovery → Build → Operate. Each stage is independently scoped; you can stop after any stage and own what\'s delivered.',
    link: null,
    linkLabel: null,
  },
];

const faqs = [
  {
    question: 'Is this required to use Synthex?',
    answer:
      'No. This is an add-on service. Synthex\'s core social-media platform is independent. The MCP App add-on is for businesses that also want a presence inside Claude and ChatGPT.',
  },
  {
    question: 'How is this different from a chatbot?',
    answer:
      'A chatbot is text-only and lives on your site. An MCP App renders interactive React views inside Claude or ChatGPT and executes real actions against your APIs — booking, scheduling, lookups, transactions. The user never opens your website.',
  },
  {
    question: 'What\'s the relationship between Skybridge and Alpic?',
    answer:
      'Alpic is the company that builds Skybridge (open-source framework, MIT) AND offers paid hosting + analytics + app-store-submission help. You can use Skybridge without Alpic hosting — self-host on any Node.js platform. We recommend Alpic for revenue-critical apps because the compliance-auditing alone is worth the cost.',
  },
  {
    question: 'How long until our MCP App is live in Claude / ChatGPT?',
    answer:
      'Discovery + Spec is 1–2 weeks. Build + Launch is 3–8 weeks from locked spec depending on integration complexity. App-store review by Anthropic and OpenAI typically adds 2–4 weeks. Realistic end-to-end: 6–14 weeks from kick-off to live in the stores.',
  },
  {
    question: 'What auth provider should we use?',
    answer:
      'Defaults Synthex applies: Clerk for multi-tenant SaaS, WorkOS for B2B with team/org structure, Stytch for passwordless education flows, Auth0 for enterprise SSO. No-auth is also valid for consumer one-shot flows. Picked during Discovery.',
  },
  {
    question: 'Do we own the code?',
    answer:
      'Yes. Repo handover at end of Build. You can take it in-house, switch hosting providers, or fork in any direction. The Operate + Evolve tier is opt-in — you can cancel and we don\'t hold the keys.',
  },
  {
    question: 'What if Anthropic or OpenAI changes their policies?',
    answer:
      'It will happen — the MCP ecosystem is young. The Operate + Evolve tier explicitly includes monitoring policy changes and re-submitting as needed. If you\'re self-hosting after handover, we publish updates to the underlying Skybridge framework as Alpic ships them and you re-deploy on your schedule.',
  },
];

export default function Page() {
  return (
    <SiteShell>
      {/* ──────────────────────────────────────────────────────────────────
          Hero
          ────────────────────────────────────────────────────────────────── */}
      <section className="px-5 pb-14 pt-32 md:pb-20 md:pt-40">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            Synthex Add-On
          </p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight tracking-tight text-white md:text-7xl">
            Your business as an{' '}
            <span className="text-transparent bg-gradient-to-r from-orange-300 via-amber-200 to-orange-300 bg-clip-text">
              MCP App
            </span>{' '}
            inside Claude + ChatGPT
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/60">
            We design, build, deploy and operate your business as an
            interactive MCP App that lives inside Claude and ChatGPT. Powered
            by{' '}
            <a
              href="https://github.com/alpic-ai/skybridge"
              target="_blank"
              rel="noreferrer noopener"
              className="text-orange-300 underline-offset-4 hover:underline"
            >
              Alpic Skybridge
            </a>
            . Submitted to the Claude + ChatGPT app stores. You own the code.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/contact?subject=mcp-app">
                Talk to us
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://docs.skybridge.tech"
                target="_blank"
                rel="noreferrer noopener"
              >
                Read the Skybridge docs
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          Why this matters
          ────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Why your business needs this now
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {whyThis.map(({ icon: Icon, title, copy }) => (
              <div
                key={title}
                className="border border-white/[0.08] bg-[#0d0f12] p-6"
              >
                <Icon className="h-5 w-5 text-orange-300" />
                <h3 className="mt-4 text-lg font-semibold text-white">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-white/55">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          Delivery tiers
          ────────────────────────────────────────────────────────────────── */}
      <section
        id="tiers"
        className="border-t border-white/[0.06] px-5 py-16 md:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            How we deliver
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
            Three independent stages. Each is independently scoped — you can
            stop after any stage and own what's been delivered.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {deliveryTiers.map(
              ({ name, indicative, timeframe, copy, inclusions }) => (
                <div
                  key={name}
                  className="flex flex-col border border-white/[0.08] bg-[#0d0f12] p-6"
                >
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                    {name}
                  </h3>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {indicative}
                  </p>
                  <p className="mt-1 text-xs text-white/45">{timeframe}</p>
                  <p className="mt-4 text-sm leading-6 text-white/60">{copy}</p>
                  <ul className="mt-5 space-y-2.5">
                    {inclusions.map(item => (
                      <li
                        key={item}
                        className="flex gap-2 text-xs leading-5 text-white/55"
                      >
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}
          </div>
          <p className="mt-6 text-xs italic text-white/40">
            Indicative figures only. Quote-on-application after the Discovery
            stage. All amounts in AUD, ex GST.
          </p>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          Cost breakdown — transparency on what you actually pay for
          ────────────────────────────────────────────────────────────────── */}
      <section
        id="cost-breakdown"
        className="border-t border-white/[0.06] px-5 py-16 md:py-24"
      >
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Cost breakdown — what you actually pay for
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
            An MCP App stack has four cost layers. The framework itself is
            free. Hosting is optional. Auth depends on volume. Our delivery
            fee is the only mandatory line item once you proceed past
            Discovery.
          </p>
          <div className="mt-10 overflow-hidden border border-white/[0.08] bg-[#0d0f12]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-white/60">
                <tr>
                  <th className="px-5 py-3 font-medium">Layer</th>
                  <th className="px-5 py-3 font-medium">Cost</th>
                  <th className="px-5 py-3 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {costModel.map(({ layer, cost, note, link, linkLabel }) => (
                  <tr key={layer}>
                    <td className="px-5 py-4 font-medium text-white">
                      {layer}
                    </td>
                    <td className="px-5 py-4 text-white/65">{cost}</td>
                    <td className="px-5 py-4 text-white/55">
                      {note}{' '}
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-orange-300 underline-offset-4 hover:underline"
                        >
                          {linkLabel} ↗
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs italic text-white/40">
            Alpic does not publish public pricing as of May 2026. We surface
            their actual quote during Discovery so you can compare against
            the self-host alternative before committing.
          </p>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          FAQ
          ────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Common questions
          </h2>
          <div className="mt-8 divide-y divide-white/[0.06]">
            {faqs.map(({ question, answer }) => (
              <details
                key={question}
                className="group py-5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-base font-medium text-white">
                  {question}
                  <span className="text-orange-300 transition-transform group-open:rotate-90">
                    ›
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-white/60">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────────
          CTA
          ────────────────────────────────────────────────────────────────── */}
      <section className="border-t border-white/[0.06] px-5 py-16 md:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Ready to talk?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/55">
            Start with a 30-minute Discovery conversation. We'll work out
            whether your business fits the MCP App pattern, what tier you'd
            need, and what the realistic timeline + cost looks like — before
            any commitment.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href="/contact?subject=mcp-app">
                Book Discovery
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a
                href="https://alpic.ai"
                target="_blank"
                rel="noreferrer noopener"
              >
                Skybridge hosting (Alpic)
              </a>
            </Button>
          </div>
        </div>
      </section>

      <SafetyStrip />
    </SiteShell>
  );
}
