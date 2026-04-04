'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQS = [
  {
    question: 'Is AI content indistinguishable?',
    answer:
      'Our neural engine is trained on your specific brand voice, editorial style, and audience data. The output is calibrated to match your established tone so precisely that even your own team cannot reliably identify AI-generated content from manually crafted posts.',
  },
  {
    question: 'How secure are the API credentials?',
    answer:
      'All platform credentials are encrypted at rest using AES-256 and transmitted exclusively over TLS 1.3. We operate on a zero-knowledge credential architecture — your tokens are never stored in plaintext and are inaccessible to Synthex personnel. OAuth 2.0 is used wherever available.',
  },
  {
    question: 'Can I override automated posts?',
    answer:
      'Absolutely. The platform offers a full editorial review queue where you can approve, modify, or reject any scheduled content before publication. You can also configure approval gates per platform, per campaign, or globally — giving you complete command over your automation pipeline.',
  },
];

/** System Operations FAQ — 3-item accordion with amber/orange theme */
export function FAQSection() {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section className="relative py-24 md:py-28 z-10">
      <div className="max-w-4xl mx-auto px-6">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#ffb87b]/10 border border-[#ffb87b]/20 mb-6">
            <span className="font-mono text-[10px] font-black tracking-[0.3em] uppercase text-[#ffb87b]">
              Support
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white">
            System Operations FAQ
          </h2>
        </div>

        {/* Accordion */}
        <div className="space-y-1">
          {FAQS.map((faq, index) => {
            const isOpen = expanded === index;
            return (
              <div
                key={index}
                className={`bg-[rgba(28,27,27,0.9)] border rounded-sm overflow-hidden transition-all duration-200 ${
                  isOpen
                    ? 'border-[rgba(255,184,123,0.2)]'
                    : 'border-[rgba(255,220,194,0.08)] hover:border-[rgba(255,220,194,0.15)]'
                }`}
              >
                <button
                  onClick={() => setExpanded(isOpen ? null : index)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left gap-4"
                  aria-expanded={isOpen}
                >
                  <h3
                    className={`text-sm font-black uppercase tracking-wide transition-colors duration-200 ${
                      isOpen ? 'text-[#ffb87b]' : 'text-white/70'
                    }`}
                  >
                    {faq.question}
                  </h3>
                  <ChevronDown
                    className={`w-4 h-4 flex-shrink-0 transition-all duration-300 ${
                      isOpen ? 'rotate-180 text-[#ffb87b]' : 'text-white/50'
                    }`}
                  />
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="px-6 pb-6 text-sm text-white/40 leading-relaxed border-t border-[rgba(255,220,194,0.05)] pt-4 font-mono">
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
