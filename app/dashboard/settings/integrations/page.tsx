import { redirect } from 'next/navigation';

/** Keys live on Settings → Integrations, not a standalone route. */
export default function SettingsIntegrationsRedirectPage() {
  redirect('/dashboard/settings?tab=integrations');
}
