'use client';

import { useState } from 'react';

// Homepage FAQ data -- used for both the visible section and the FAQPage JSON-LD schema.
// All values are hardcoded constants with no user input.
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
 * Builds the FAQPage JSON-LD schema string from the HOMEPAGE_FAQS constant array.
 * Safe for innerHTML injection because all values are hardcoded string literals.
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

/** Landing page FAQ accordion section */
export function FAQSection() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <section className="relative py-32 z-10">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium mb-6">
            Got Questions?
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Frequently Asked <span className="text-cyan-400">Questions</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Everything you need to know about SYNTHEX and how it can transform your social media marketing.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto space-y-4">
          {HOMEPAGE_FAQS.map((faq, index) => (
            <div
              key={index}
              className="bg-gradient-to-b from-white/5 to-transparent border border-white/10 rounded-2xl overflow-hidden hover:border-cyan-500/20 transition-all duration-300"
            >
              <button
                onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                className="w-full px-8 py-6 flex items-center justify-between text-left group"
                aria-expanded={expandedFaq === index}
              >
                <h3 className="text-lg font-semibold text-white pr-4 group-hover:text-cyan-400 transition-colors">
                  {faq.question}
                </h3>
                <svg
                  className={`w-5 h-5 text-cyan-400 shrink-0 transition-transform duration-300 ${
                    expandedFaq === index ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  expandedFaq === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}
              >
                <p className="px-8 pb-6 text-gray-400 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
