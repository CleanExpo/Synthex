import { generateMetadata } from '@/lib/seo/metadata';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { ArrowRight } from '@/components/icons';

export const metadata = generateMetadata({
  title: 'Case Studies',
  description:
    'Case studies from businesses using Synthex AI marketing automation.',
  path: '/case-studies',
  keywords: [
    'case studies',
    'customer success',
    'AI marketing results',
    'marketing ROI',
  ],
});

export default function CaseStudiesPage() {
  return (
    <MarketingLayout currentPage="case-studies">
      <section className="pt-12 pb-16 px-6">
        <div className="container mx-auto text-center max-w-3xl">
          <h1 className="text-5xl font-bold text-white mb-6">
            Success Stories
          </h1>
          <p className="text-xl text-gray-400 mb-10">
            Case studies are being prepared. Get in touch to hear how businesses
            are using Synthex to run their social media.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white px-10 py-6 text-lg shadow-lg shadow-orange-500/25"
              >
                Talk to us
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button
                size="lg"
                variant="outline"
                className="border-orange-500/30 text-white hover:bg-orange-500/10 px-10 py-6 text-lg"
              >
                View Pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
