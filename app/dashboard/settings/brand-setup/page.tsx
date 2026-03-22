import { BrandSetupWizard } from '@/components/settings/brand-setup-wizard';

export const metadata = {
  title: 'Brand Setup | Synthex',
  description: 'Set up your brand profile in a few steps',
};

export default function BrandSetupPage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
          Settings
        </span>
        <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
          Brand Setup
        </h1>
        <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
          Set up your brand profile in a few steps
        </p>
      </div>
      <BrandSetupWizard />
    </div>
  );
}
