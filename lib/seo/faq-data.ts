// Homepage FAQ data and schema builder — no React, safe in Server Components.

export const HOMEPAGE_FAQS = [
  {
    question: 'How does Synthex learn my writing style?',
    answer:
      'You upload 20–30 of your best-performing posts during onboarding. Our AI analyses patterns in your tone, vocabulary, sentence structure, and what content resonates with your audience. The more you use it, the smarter it gets.',
  },
  {
    question: 'Which platforms does Synthex support?',
    answer:
      'Synthex supports Instagram, TikTok, Twitter/X, LinkedIn, Facebook, YouTube, Pinterest, Reddit, and Threads — all from one dashboard.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes — every plan includes a 14-day free trial, no credit card required. You get full access to all features in your chosen plan.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Absolutely. Cancel from your dashboard at any time with no lock-in contracts or cancellation fees. Your data remains accessible for 30 days after cancellation.',
  },
  {
    question: "What's the difference between Starter, Pro, and Agency?",
    answer:
      'Starter ($49/mo) covers 1 user, 3 platforms, and 50 posts/month — perfect for solo creators. Pro ($99/mo) adds unlimited posts, all 9 platforms, and up to 5 team members. Agency ($249/mo) unlocks unlimited seats, white-label reports, and priority support.',
  },
  {
    question: 'Does Synthex post automatically or do I review content first?',
    answer:
      'Both options are available. You can set fully automatic scheduling or use the review-before-publish flow. Most users review content initially, then switch to auto-post once they trust their trained AI voice.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. We use AES-256 encryption for stored credentials, never store your social media passwords (OAuth only), and are fully GDPR compliant. Your content and brand data are never used to train models for other customers.',
  },
];

/**
 * Builds the FAQPage JSON-LD schema string from HOMEPAGE_FAQS.
 * All values are hardcoded string literals — safe for dangerouslySetInnerHTML.
 */
export function buildFaqSchemaJson(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: HOMEPAGE_FAQS.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  });
}
