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
    className: 'bg-cyan-500/20 border-cyan-500/30 text-cyan-200',
  },
  scheduling: {
    label: 'Scheduling',
    className: 'bg-amber-500/20 border-amber-500/30 text-amber-200',
  },
  automation: {
    label: 'Automation',
    className: 'bg-purple-500/20 border-purple-500/30 text-purple-200',
  },
};
