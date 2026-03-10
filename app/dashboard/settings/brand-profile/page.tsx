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
  description: 'Manage your organisation brand identity, colours, and social handles.',
};

export default function BrandProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Brand Profile</h1>
        <p className="text-slate-400 mt-1">
          Manage your organisation&apos;s brand identity, colours, and social presence
        </p>
      </div>
      <BrandProfileTab />
    </div>
  );
}
