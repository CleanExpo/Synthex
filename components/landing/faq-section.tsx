'use client';

import { useState } from 'react';
import { HOMEPAGE_FAQS } from '@/lib/seo/faq-data';

/** FAQ accordion — normalised Scientific Luxury borders and typography */
export function FAQSection() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section className="relative py-16 md:py-20 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section header */}
        <div className="mb-10 flex flex-col lg:flex-row lg:items-end gap-8">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/30 mb-4 block">
              Common Questions
            </span>
            <h2 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white">
              Everything you need
              <br />
              <span className="text-cyan-400">to know.</span>
            </h2>
          </div>
          <p className="text-white/40 text-sm max-w-xs leading-relaxed lg:ml-auto lg:text-right">
            Still have questions? Email us at{' '}
            <a
              href="mailto:hello@synthex.social"
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              hello@synthex.social
            </a>
          </p>
        </div>

        {/* FAQ accordion */}
        <div className="max-w-3xl space-y-[0.5px]">
          {HOMEPAGE_FAQS.map((faq, index) => {
            const isOpen = expanded === index;
            return (
              <div
                key={index}
                className={`border-[0.5px] overflow-hidden transition-colors duration-200 ${
                  isOpen
                    ? 'border-white/[0.12] bg-white/[0.03]'
                    : 'border-white/[0.06] bg-white/[0.01] hover:border-white/[0.1]'
                }`}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left gap-4"
                  aria-expanded={isOpen}
                >
                  <h3
                    className={`text-sm font-medium leading-relaxed transition-colors duration-200 ${
                      isOpen ? 'text-white' : 'text-white/70'
                    }`}
                  >
                    {faq.question}
                  </h3>
                  <div
                    className={`flex-shrink-0 w-5 h-5 flex items-center justify-center border-[0.5px] rounded-sm transition-all duration-300 ${
                      isOpen
                        ? 'border-cyan-400/40 bg-cyan-400/10'
                        : 'border-white/[0.1]'
                    }`}
                  >
                    <svg
                      className={`w-3 h-3 transition-transform duration-300 ${isOpen ? 'rotate-180 text-cyan-400' : 'text-white/40'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="px-6 pb-6 text-sm text-white/50 leading-relaxed border-t border-[0.5px] border-white/[0.04] pt-4">
                    {faq.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
