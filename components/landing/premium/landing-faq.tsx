import { SectionReveal } from './section-reveal';
import { landingFaqs } from './landing-faq-data';

export { landingFaqs } from './landing-faq-data';

export function LandingFaq() {
  return (
    <section
      className="relative overflow-hidden bg-sx-bg-secondary py-24 md:py-32"
      aria-labelledby="faq-heading"
      itemScope
      itemType="https://schema.org/FAQPage"
    >
      <div className="relative mx-auto max-w-content px-5">
        <SectionReveal>
          <div className="mb-12 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
              FAQ
            </p>
            <h2
              id="faq-heading"
              className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-4xl"
            >
              Questions operators actually ask
            </h2>
          </div>
        </SectionReveal>

        <dl className="divide-y divide-white/[0.06] rounded-card border border-white/[0.08] bg-sx-bg-elevated">
          {landingFaqs.map((faq, index) => (
            <SectionReveal key={faq.question} delay={index * 30}>
              <div
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
            </SectionReveal>
          ))}
        </dl>
      </div>
    </section>
  );
}
