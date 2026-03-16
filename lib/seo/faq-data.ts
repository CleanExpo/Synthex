// Homepage FAQ data and schema builder — no React, safe in Server Components.

export const HOMEPAGE_FAQS = [
  {
    question: 'What is Synthex?',
    answer:
      'Synthex is a fully autonomous AI marketing platform that creates, schedules, optimises, and publishes content across 9 social media platforms without manual involvement. Think of it as replacing your entire social media agency — available 24/7, at a fraction of the cost.',
  },
  {
    question: 'What social media platforms does Synthex support?',
    answer:
      'Synthex supports all 9 major platforms: LinkedIn, Instagram, TikTok, YouTube, X (Twitter), Facebook, Pinterest, Reddit, and Threads. Every platform receives content tailored to its unique algorithm, format requirements, and audience behaviour — not generic reposts.',
  },
  {
    question: 'What is BYOK and how does it work?',
    answer:
      'BYOK stands for Bring Your Own Keys. You connect your own API keys from OpenAI, Anthropic, or Google AI directly to Synthex. The AI generation runs through your accounts, so you pay provider rates (typically cents per post) rather than a markup. This can reduce your AI costs by up to 80% compared to platforms that bundle API costs into their pricing.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes. Synthex offers a 14-day free trial with full access to all features — including AI content generation, multi-platform scheduling, analytics, and competitor analysis. No credit card required to get started. You can cancel at any time, for any reason.',
  },
  {
    question: 'How is Synthex different from Buffer, Hootsuite, or Later?',
    answer:
      'Scheduling tools like Buffer and Hootsuite require you to create content yourself — they just help you post it. Synthex is an autonomous marketing platform: it generates the content, runs A/B tests, determines optimal posting times, tracks competitors, and continuously refines your strategy. It\'s the difference between a calendar app and a full marketing team.',
  },
  {
    question: 'How does the AI learn my brand voice?',
    answer:
      'Synthex builds a brand voice profile by analysing your existing content, top-performing posts, and audience responses. You can also provide direct brand guidelines, tone preferences, and content examples during onboarding. The AI improves its understanding the more you use the platform — every published post and engagement signal feeds back into your profile.',
  },
  {
    question: 'Can I review content before it publishes?',
    answer:
      'Yes. Synthex includes a full approval workflow — you can configure it to require human review for all posts, specific content types, or above certain confidence thresholds. You can also run in fully autonomous mode where the AI publishes based on your pre-set rules. The choice is yours.',
  },
  {
    question: 'What analytics does Synthex provide?',
    answer:
      'Synthex includes real-time analytics across all connected platforms: engagement rates, follower growth, reach, impressions, click-throughs, and platform distribution. Advanced features include predictive ROI modelling, competitor benchmarking, viral pattern detection, and optimal posting time forecasting based on your specific audience behaviour.',
  },
  {
    question: 'Is Synthex secure?',
    answer:
      'All OAuth tokens and API keys are encrypted using AES-256-GCM. Your credentials are never stored in plaintext, never included in AI prompts, and are organisation-scoped — meaning no data crosses between different accounts. Synthex is built on enterprise-grade infrastructure (Supabase, Vercel) with full audit logging.',
  },
  {
    question: 'What does Synthex cost?',
    answer:
      'Plans start from $249 per month. If you bring your own API keys (BYOK), your effective cost per post is dramatically lower. Custom enterprise pricing is available for agencies and multi-brand operations. All plans include a 14-day free trial — no credit card required.',
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
    mainEntity: HOMEPAGE_FAQS.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  });
}
