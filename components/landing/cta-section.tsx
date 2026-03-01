'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@/components/icons';
import { SynthexLogo } from './synthex-logo';

/** Landing page bottom call-to-action banner */
export function CTASection() {
  return (
    <section className="relative py-32 z-10">
      <div className="container mx-auto px-6">
        <div className="relative overflow-hidden bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 border border-cyan-500/20 rounded-3xl p-12 sm:p-16 text-center">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5" />

          <div className="relative z-10">
            <SynthexLogo className="w-16 h-16 mx-auto mb-8" />
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Ready to transform your marketing?
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Join thousands of businesses using Synthex to automate their social media success.
            </p>
            <Link href="/signup">
              <Button
                size="lg"
                className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold shadow-xl shadow-cyan-500/30 px-10 py-6 text-lg rounded-xl transition-all hover:shadow-cyan-500/50"
              >
                Get Started Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
