/**
 * Third-Party Integrations Module
 *
 * @description Unified exports for third-party integration services.
 * Factory function creates the correct service for each provider.
 */

// Types
export type {
  IntegrationProvider,
  IntegrationCategory,
  ThirdPartyConfig,
  IntegrationCredentials,
  IntegrationStatus,
  CanvaDesign,
  CanvaImportResult,
  BufferProfile,
  BufferPost,
  BufferAnalytics,
  ZapierHook,
  ZapierTestResult,
} from './types';

export { INTEGRATION_REGISTRY } from './types';

// Services
export { CanvaService } from './canva-service';
export { BufferService } from './buffer-service';
export { ZapierService, ZAPIER_SUPPORTED_EVENTS } from './zapier-service';
export type { ZapierEvent } from './zapier-service';

// ============================================================================
// IMPORTS FOR FACTORY
// ============================================================================

import type { IntegrationProvider, IntegrationCredentials, ThirdPartyConfig } from './types';
import { INTEGRATION_REGISTRY } from './types';
import { CanvaService } from './canva-service';
import { BufferService } from './buffer-service';
import { ZapierService } from './zapier-service';

// ============================================================================
// SUPPORTED PROVIDERS
// ============================================================================

export const SUPPORTED_PROVIDERS: IntegrationProvider[] = ['canva', 'buffer', 'zapier'];

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create the appropriate integration service for a provider.
 *
 * @param provider - The integration provider ('canva', 'buffer', 'zapier')
 * @param credentials - Credentials for the provider
 * @returns The service instance for the given provider
 */
export function createIntegrationService(
  provider: IntegrationProvider,
  credentials: IntegrationCredentials
): CanvaService | BufferService | ZapierService {
  switch (provider) {
    case 'canva':
      return new CanvaService(credentials);
    case 'buffer':
      return new BufferService(credentials);
    case 'zapier':
      return new ZapierService(credentials);
    default:
      throw new Error(`Unsupported integration provider: ${provider}`);
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the configuration for a specific provider.
 */
export function getIntegrationConfig(provider: IntegrationProvider): ThirdPartyConfig {
  const config = INTEGRATION_REGISTRY[provider];
  if (!config) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }
  return config;
}

/**
 * Type guard to check if a string is a valid IntegrationProvider.
 */
export function isValidProvider(str: string): str is IntegrationProvider {
  return SUPPORTED_PROVIDERS.includes(str as IntegrationProvider);
}
