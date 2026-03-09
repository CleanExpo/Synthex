'use client';

import { useState } from 'react';
import { HOMEPAGE_FAQS } from '@/lib/seo/faq-data';

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
