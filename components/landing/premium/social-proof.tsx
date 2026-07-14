import { SectionFloatingGradients } from './floating-gradients';

const testimonials = [
  {
    quote:
      'We stopped losing campaign context in Slack threads. Synthex gives us a plan we can actually approve before anything goes live.',
    role: 'Marketing Director',
    org: 'Pilot partner · Professional services',
  },
  {
    quote:
      'The evidence panel changed how our team trusts AI output. Every recommendation has a source — that is non-negotiable for us.',
    role: 'Agency Operator',
    org: 'Pilot partner · Multi-client agency',
  },
  {
    quote:
      'Approval gates are not a checkbox here. Nothing publishes until a named reviewer signs off. That is exactly what we needed.',
    role: 'Head of Content',
    org: 'Pilot partner · In-house team',
  },
];

export function SocialProof() {
  return (
    <section
      className="relative overflow-hidden border-y border-white/[0.04] bg-sx-bg-panel py-32"
      aria-labelledby="social-proof-heading"
    >
      <SectionFloatingGradients variant="mid" />
      <div className="relative mx-auto max-w-content px-5">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            Pilot customers
          </p>
          <h2
            id="social-proof-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-4xl"
          >
            Built with operators running controlled pilots
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {testimonials.map(item => (
            <blockquote
              key={item.role}
              className="rounded-card border border-white/[0.08] bg-sx-bg-elevated/90 p-6 backdrop-blur-sm"
              itemScope
              itemType="https://schema.org/Review"
            >
              <p
                className="text-sm leading-7 text-sx-text-secondary"
                itemProp="reviewBody"
              >
                &ldquo;{item.quote}&rdquo;
              </p>
              <footer className="mt-6 border-t border-white/[0.06] pt-4">
                <cite className="not-italic">
                  <span
                    className="block text-sm font-semibold text-sx-text-primary"
                    itemProp="author"
                  >
                    {item.role}
                  </span>
                  <span className="mt-1 block text-xs text-sx-text-muted">
                    {item.org}
                  </span>
                </cite>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
