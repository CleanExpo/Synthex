import PsychologyBrandGenerator from '@/components/strategic-marketing/PsychologyBrandGenerator';
import MarketingLayout from '@/components/marketing/MarketingLayout';

export default function BrandGeneratorPage() {
  return (
    <MarketingLayout currentPage="brand-generator" showFooter={true}>
      <PsychologyBrandGenerator />
    </MarketingLayout>
  );
}

export const metadata = {
  title: { absolute: 'Psychology-Powered Brand Generator | SYNTHEX' },
  description:
    'Generate strategic brand identities using psychological principles.',
};
