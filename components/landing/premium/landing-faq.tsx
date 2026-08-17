import { SectionAtmosphere } from './section-atmosphere';
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
      <SectionAtmosphere variant="ink" />
      <div className="relative mx-auto grid max-w-container gap-12 px-5 lg:grid-cols-[0.7fr_1.3fr]">
        <SectionReveal>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sx-accent">
            FAQ
          </p>
          <h2
            id="faq-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-sx-text-primary md:text-4xl"
          >
            Questions operators actually ask
          </h2>
        </SectionReveal>

        <dl className="space-y-3">
          {landingFaqs.map((faq, index) => (
            <SectionReveal key={faq.question} delay={index * 30}>
              <div
                className="rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 p-6"
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
