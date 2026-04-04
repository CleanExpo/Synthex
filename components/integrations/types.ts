/**
 * Third-Party Integration UI Component Types
 *
 * @description Props interfaces for ThirdPartyCard and ConnectDialog components.
 * Uses ThirdPartyProvider and IntegrationCategory from lib/integrations/types.
 */

import type { ThirdPartyProvider } from '@/hooks/use-third-party-integrations';
import type { IntegrationCategory } from '@/lib/integrations/types';

// ============================================================================
// THIRD-PARTY CARD PROPS
// ============================================================================

export interface ThirdPartyCardProps {
  provider: ThirdPartyProvider;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: IntegrationCategory;
  connected: boolean;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onConfigure?: () => void;
}

// ============================================================================
// CONNECT DIALOG PROPS
// ============================================================================

export interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: ThirdPartyProvider;
  providerName: string;
  requiredFields: string[];
  oauthSupported: boolean;
  onSubmit: (credentials: Record<string, string>) => Promise<void>;
}

// ============================================================================
// CATEGORY BADGE CONFIG
// ============================================================================

export const CATEGORY_BADGE_STYLES: Record<
  IntegrationCategory,
  { label: string; className: string }
> = {
  design: {
    label: 'Design',
    className: 'bg-orange-500/20 border-orange-500/30 text-orange-200',
  },
  scheduling: {
    label: 'Scheduling',
    className: 'bg-orange-500/20 border-orange-500/30 text-orange-200',
  },
  automation: {
    label: 'Automation',
    className: 'bg-orange-500/20 border-orange-500/30 text-orange-200',
  },
};
