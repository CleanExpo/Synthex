// Homepage FAQ data and schema builder — no React, safe in Server Components.

export const HOMEPAGE_FAQS = [
  {
    question: 'What is SYNTHEX?',
    answer:
      'SYNTHEX is the world\'s first fully autonomous AI marketing agency. It uses advanced artificial intelligence to create, schedule, optimise, and publish social media content across 9 major platforms -- all from a single dashboard. Think of it as your always-on marketing team that works 24/7.',
  },
  {
    question: 'What platforms does SYNTHEX support?',
    answer:
      'SYNTHEX supports 9 major social media platforms: YouTube, Instagram, TikTok, X (Twitter), Facebook, LinkedIn, Pinterest, Reddit, and Threads. You can manage all your accounts from one unified dashboard, with AI-optimised content tailored to each platform\'s unique requirements and audience.',
  },
  {
    question: 'How does AI content generation work?',
    answer:
      'SYNTHEX uses multiple AI models (including OpenAI, Anthropic, and Google AI) to generate platform-specific content. Simply choose your platform and topic, and the AI creates multiple content variations with optimised hooks, hashtags, and engagement strategies. You can also bring your own API keys (BYOK) to reduce costs while maintaining full control over your AI usage.',
  },
  {
    question: 'Is there a free trial?',
    answer:
      'Yes! SYNTHEX offers a 14-day free trial with full access to all features. No credit card is required to get started. You can explore AI content generation, scheduling, analytics, and multi-platform management before committing to a paid plan.',
  },
  {
    question: 'What makes SYNTHEX different from other social media tools?',
    answer:
      'Unlike traditional scheduling tools, SYNTHEX is a complete AI marketing agency. It doesn\'t just schedule posts -- it creates them, analyses performance, predicts optimal posting times, tracks competitors, runs A/B tests, and continuously optimises your strategy. Plus, the BYOK (Bring Your Own Keys) model means you control your AI costs.',
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
