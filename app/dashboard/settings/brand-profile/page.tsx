/**
 * Brand Profile Settings Page
 *
 * Server component wrapper — exports metadata and renders the
 * BrandProfileTab client component.
 *
 * @task SYN-55 - Brand Profile Setup
 */

import { Metadata } from 'next';
import { BrandProfileTab } from '@/components/settings/brand-profile-tab';

export const metadata: Metadata = {
  title: 'Brand Profile | Synthex',
  description:
    'Manage your organisation brand identity, colours, and social handles.',
};

export default function BrandProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-2 block">
          Settings
        </span>
        <h1 className="text-3xl sm:text-4xl font-extralight tracking-tight text-white">
          Brand Profile
        </h1>
        <p className="mt-1.5 text-sm text-white/40 leading-relaxed">
          Manage your organisation&apos;s brand identity, colours, and social
          presence
        </p>
      </div>
      <BrandProfileTab />
    </div>
  );
}
