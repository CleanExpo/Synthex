/**
 * Vault — Centralised Secrets Management
 *
 * Re-exports the VaultService singleton and all types/schemas.
 *
 * @example
 * import { VaultService, CreateSecretSchema } from '@/lib/vault';
 */

export { VaultService } from './vault-service';

export {
  // Enums
  SECRET_TYPES,
  PROVIDERS,
  SECRET_SOURCES,
  VAULT_ACTIONS,
  ACTOR_TYPES,
  OUTCOMES,

  // Zod Schemas
  CreateSecretSchema,
  RotateSecretSchema,
  DeleteSecretSchema,
  DecryptSecretSchema,
  ListSecretsQuerySchema,
  AccessLogQuerySchema,

  // Types
  type SecretType,
  type Provider,
  type SecretSource,
  type VaultAction,
  type ActorType,
  type Outcome,
  type CreateSecretInput,
  type RotateSecretInput,
  type DeleteSecretInput,
  type DecryptSecretInput,
  type ListSecretsQuery,
  type AccessLogQuery,
  type VaultSecretOutput,
  type VaultAccessLogEntry,
  type VaultActor,
  type VaultCreateParams,

  // Helpers
  slugify,
} from './types';
