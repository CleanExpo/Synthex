const faqs = [
  {
    question: 'What is an AI marketing operating system?',
    answer:
      'An AI marketing operating system connects intake, research, campaign planning, creative production, approvals, publishing and performance in one workspace — with evidence and governance at every stage. Synthex is built as a marketing command center, not a disconnected tool stack.',
  },
  {
    question: 'How does Synthex handle campaign approval workflows?',
    answer:
      'Every asset passes through explicit human approval gates before publishing, ad spend or public claims. Reviewers see preview, comments, version diff and evidence sources. Nothing auto-publishes.',
  },
  {
    question: 'Is Synthex suitable for agencies and enterprise teams?',
    answer:
      'Yes. Synthex supports multi-brand workspaces, role permissions, audit trails and agency client lanes. Pilot access is invite-only while we expand capacity.',
  },
  {
    question: 'How is AI output kept evidence-backed?',
    answer:
      'Research council packets link strategy to source refs before creative is drafted. The evidence panel shows sources, confidence and reasoning — never a black-box "AI magic" response.',
  },
  {
    question: 'What marketing channels does Synthex support?',
    answer:
      'YouTube, Facebook, LinkedIn, Instagram, email, web assets, Google Business Profile and more — all sharing one strategy spine with approval-gated publishing per channel.',
  },
];

export function LandingFaq() {
  return (
    <section
      className="bg-sx-bg-secondary py-32"
      aria-labelledby="faq-heading"
      itemScope
      itemType="https://schema.org/FAQPage"
    >
      <div className="mx-auto max-w-content px-5">
        <div className="mb-14 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            FAQ
          </p>
          <h2
            id="faq-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-4xl"
          >
            Common questions about Synthex
          </h2>
        </div>

        <dl className="divide-y divide-white/[0.06] rounded-card border border-white/[0.08] bg-sx-bg-elevated">
          {faqs.map(faq => (
            <div
              key={faq.question}
              className="p-6"
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <dt
                className="text-base font-semibold text-sx-text-primary"
                itemProp="name"
              >
                {faq.question}
              </dt>
              <dd
                className="mt-3 text-sm leading-7 text-sx-text-muted"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <span itemProp="text">{faq.answer}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
