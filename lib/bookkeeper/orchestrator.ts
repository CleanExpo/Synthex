/**
 * Bookkeeper Orchestrator — Xero Transaction Sync
 *
 * Handles write and read of bookkeeper_transactions rows, ensuring that
 * raw_xero_data (full Xero API JSON) is always stored encrypted.
 *
 * ENCRYPTION SCHEME (UNI-1593):
 *   - Algorithm : AES-256-GCM via lib/security/field-encryption.ts
 *   - Wire format: enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>
 *   - WRITE      : encryptField(JSON.stringify(rawXeroData)) → rawXeroDataEncrypted
 *   - READ       : decryptField(rawXeroDataEncrypted) → JSON.parse → object
 *   - FALLBACK   : if rawXeroDataEncrypted is null, fall back to rawXeroData (legacy rows)
 *
 * NOTE: rawXeroDataIv / rawXeroDataSalt columns exist in the database from a prior
 * encryption attempt and are NOT used by this implementation.
 */

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { encryptField, decryptField } from '@/lib/security/field-encryption';
import { logger } from '@/lib/logger';

// =============================================================================
// Types
// =============================================================================

/** Raw Xero API JSON — free-form object from the Xero API response. */
export type XeroRawPayload = Record<string, unknown>;

/** Parameters required to upsert a bookkeeper transaction. */
export interface UpsertBookkeeperTransactionParams {
  runId: string;
  founderId: string;
  businessKey: string;
  xeroTenantId: string;
  xeroTransactionId: string;
  transactionDate: Date;
  description?: string;
  amountCents: bigint;
  currency?: string;
  reconciliationStatus: string;
  confidenceScore?: number;
  matchedInvoiceId?: string;
  matchedBillId?: string;
  taxCode?: string;
  gstAmountCents?: bigint;
  taxCategory?: string;
  isDeductible?: boolean;
  deductionCategory?: string;
  deductionNotes?: string;
  approvalQueueId?: string;
  approvedBy?: string;
  approvedAt?: Date;
  /** Full Xero API response payload — MUST be encrypted before persisting. */
  rawXeroData: XeroRawPayload;
}

/** A bookkeeper transaction row with rawXeroData decrypted back to an object. */
export interface BookkeeperTransactionOutput {
  id: string;
  runId: string;
  founderId: string;
  businessKey: string;
  xeroTenantId: string;
  xeroTransactionId: string;
  transactionDate: Date;
  description: string | null;
  amountCents: bigint;
  currency: string;
  reconciliationStatus: string;
  confidenceScore: string; // Prisma returns Decimal as string
  matchedInvoiceId: string | null;
  matchedBillId: string | null;
  taxCode: string | null;
  gstAmountCents: bigint;
  taxCategory: string | null;
  isDeductible: boolean;
  deductionCategory: string | null;
  deductionNotes: string | null;
  approvalQueueId: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  /** Decrypted Xero payload, or null if decryption fails. */
  rawXeroData: XeroRawPayload | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Encrypt a raw Xero payload object for storage.
 *
 * @param payload - The raw Xero API JSON object
 * @returns Encrypted ciphertext string (enc:v1:...) or null on failure
 */
function encryptXeroPayload(payload: XeroRawPayload): string | null {
  try {
    const json = JSON.stringify(payload);
    return encryptField(json);
  } catch (err) {
    logger.error('[Bookkeeper] Failed to encrypt raw_xero_data', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Decrypt a stored ciphertext back to a Xero payload object.
 *
 * Falls back gracefully:
 * 1. Try decryptField(rawXeroDataEncrypted) → JSON.parse
 * 2. If rawXeroDataEncrypted is null, fall back to rawXeroData (legacy unencrypted JSONB)
 * 3. Return null if both are unavailable or decryption fails
 *
 * @param encrypted - The encrypted string from raw_xero_data_encrypted
 * @param legacy    - The legacy JSONB value from raw_xero_data (may be null)
 */
function decryptXeroPayload(
  encrypted: string | null,
  legacy: unknown
): XeroRawPayload | null {
  // Prefer the encrypted column
  if (encrypted) {
    try {
      const json = decryptField(encrypted);
      if (!json) return null;
      return JSON.parse(json) as XeroRawPayload;
    } catch (err) {
      logger.error('[Bookkeeper] Failed to decrypt raw_xero_data_encrypted', {
        error: err instanceof Error ? err.message : String(err),
      });
      // Fall through to legacy
    }
  }

  // Legacy fallback — plaintext JSONB (already a parsed object from Prisma)
  if (legacy !== null && legacy !== undefined) {
    logger.warn(
      '[Bookkeeper] Returning legacy unencrypted raw_xero_data — row needs back-fill migration'
    );
    return legacy as XeroRawPayload;
  }

  return null;
}

/**
 * Map a Prisma row to the output type, decrypting the payload in the process.
 */
function toOutput(row: {
  id: string;
  runId: string;
  founderId: string;
  businessKey: string;
  xeroTenantId: string;
  xeroTransactionId: string;
  transactionDate: Date;
  description: string | null;
  amountCents: bigint;
  currency: string;
  reconciliationStatus: string;
  confidenceScore: { toString(): string };
  matchedInvoiceId: string | null;
  matchedBillId: string | null;
  taxCode: string | null;
  gstAmountCents: bigint;
  taxCategory: string | null;
  isDeductible: boolean;
  deductionCategory: string | null;
  deductionNotes: string | null;
  approvalQueueId: string | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rawXeroData: unknown;
  rawXeroDataEncrypted: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BookkeeperTransactionOutput {
  return {
    id: row.id,
    runId: row.runId,
    founderId: row.founderId,
    businessKey: row.businessKey,
    xeroTenantId: row.xeroTenantId,
    xeroTransactionId: row.xeroTransactionId,
    transactionDate: row.transactionDate,
    description: row.description,
    amountCents: row.amountCents,
    currency: row.currency,
    reconciliationStatus: row.reconciliationStatus,
    confidenceScore: row.confidenceScore.toString(),
    matchedInvoiceId: row.matchedInvoiceId,
    matchedBillId: row.matchedBillId,
    taxCode: row.taxCode,
    gstAmountCents: row.gstAmountCents,
    taxCategory: row.taxCategory,
    isDeductible: row.isDeductible,
    deductionCategory: row.deductionCategory,
    deductionNotes: row.deductionNotes,
    approvalQueueId: row.approvalQueueId,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
    rawXeroData: decryptXeroPayload(row.rawXeroDataEncrypted, row.rawXeroData),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// =============================================================================
// BookkeeperOrchestrator
// =============================================================================

export const BookkeeperOrchestrator = {
  /**
   * Upsert a bookkeeper transaction, encrypting rawXeroData before persisting.
   *
   * On conflict (founderId + xeroTransactionId), updates the existing row in full.
   * Encryption is required — if encryptXeroPayload fails, the upsert is aborted.
   *
   * @param params - Transaction parameters including the raw Xero payload
   * @returns The upserted row with rawXeroData decrypted
   * @throws Error if encryption fails
   */
  async upsertTransaction(
    params: UpsertBookkeeperTransactionParams
  ): Promise<BookkeeperTransactionOutput> {
    const encryptedPayload = encryptXeroPayload(params.rawXeroData);
    if (encryptedPayload === null) {
      throw new Error(
        '[Bookkeeper] Cannot persist transaction: encryption of raw_xero_data failed. ' +
          'Check FIELD_ENCRYPTION_KEY is set and valid.'
      );
    }

    const row = await prisma.bookkeeperTransaction.upsert({
      where: {
        founderId_xeroTransactionId: {
          founderId: params.founderId,
          xeroTransactionId: params.xeroTransactionId,
        },
      },
      create: {
        runId: params.runId,
        founderId: params.founderId,
        businessKey: params.businessKey,
        xeroTenantId: params.xeroTenantId,
        xeroTransactionId: params.xeroTransactionId,
        transactionDate: params.transactionDate,
        description: params.description ?? null,
        amountCents: params.amountCents,
        currency: params.currency ?? 'AUD',
        reconciliationStatus: params.reconciliationStatus,
        confidenceScore: params.confidenceScore ?? 0,
        matchedInvoiceId: params.matchedInvoiceId ?? null,
        matchedBillId: params.matchedBillId ?? null,
        taxCode: params.taxCode ?? null,
        gstAmountCents: params.gstAmountCents ?? BigInt(0),
        taxCategory: params.taxCategory ?? null,
        isDeductible: params.isDeductible ?? false,
        deductionCategory: params.deductionCategory ?? null,
        deductionNotes: params.deductionNotes ?? null,
        approvalQueueId: params.approvalQueueId ?? null,
        approvedBy: params.approvedBy ?? null,
        approvedAt: params.approvedAt ?? null,
        // Encrypted column only — do NOT write plaintext to rawXeroData
        rawXeroDataEncrypted: encryptedPayload,
        rawXeroData: Prisma.JsonNull,
      },
      update: {
        runId: params.runId,
        businessKey: params.businessKey,
        xeroTenantId: params.xeroTenantId,
        transactionDate: params.transactionDate,
        description: params.description ?? null,
        amountCents: params.amountCents,
        currency: params.currency ?? 'AUD',
        reconciliationStatus: params.reconciliationStatus,
        confidenceScore: params.confidenceScore ?? 0,
        matchedInvoiceId: params.matchedInvoiceId ?? null,
        matchedBillId: params.matchedBillId ?? null,
        taxCode: params.taxCode ?? null,
        gstAmountCents: params.gstAmountCents ?? BigInt(0),
        taxCategory: params.taxCategory ?? null,
        isDeductible: params.isDeductible ?? false,
        deductionCategory: params.deductionCategory ?? null,
        deductionNotes: params.deductionNotes ?? null,
        approvalQueueId: params.approvalQueueId ?? null,
        approvedBy: params.approvedBy ?? null,
        approvedAt: params.approvedAt ?? null,
        rawXeroDataEncrypted: encryptedPayload,
        updatedAt: new Date(),
      },
    });

    return toOutput(row);
  },

  /**
   * Retrieve a single transaction by its Xero transaction ID, decrypting the payload.
   *
   * @param founderId         - The founder's user ID (for row-level security)
   * @param xeroTransactionId - The Xero transaction UUID
   * @returns Decrypted transaction output, or null if not found
   */
  async getTransaction(
    founderId: string,
    xeroTransactionId: string
  ): Promise<BookkeeperTransactionOutput | null> {
    const row = await prisma.bookkeeperTransaction.findUnique({
      where: {
        founderId_xeroTransactionId: { founderId, xeroTransactionId },
      },
    });

    return row ? toOutput(row) : null;
  },

  /**
   * List all transactions for a founder, decrypting each row's payload.
   *
   * @param founderId - The founder's user ID
   * @param options   - Optional filters and pagination
   */
  async listTransactions(
    founderId: string,
    options?: {
      businessKey?: string;
      reconciliationStatus?: string;
      fromDate?: Date;
      toDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<BookkeeperTransactionOutput[]> {
    const where: Record<string, unknown> = { founderId };

    if (options?.businessKey) where.businessKey = options.businessKey;
    if (options?.reconciliationStatus)
      where.reconciliationStatus = options.reconciliationStatus;
    if (options?.fromDate || options?.toDate) {
      where.transactionDate = {
        ...(options.fromDate ? { gte: options.fromDate } : {}),
        ...(options.toDate ? { lte: options.toDate } : {}),
      };
    }

    const rows = await prisma.bookkeeperTransaction.findMany({
      where,
      orderBy: { transactionDate: 'desc' },
      take: options?.limit ?? 100,
      skip: options?.offset ?? 0,
    });

    return rows.map(toOutput);
  },

  /**
   * Back-fill encryption: find rows where rawXeroDataEncrypted is null but rawXeroData
   * has a legacy plaintext value, encrypt it, and null out the plaintext column.
   *
   * Safe to run multiple times (idempotent).
   *
   * @param founderId - Scope to a single founder (required for safety)
   * @param batchSize - Number of rows to process per iteration (default 50)
   * @returns Count of rows updated
   */
  async backFillEncryption(founderId: string, batchSize = 50): Promise<number> {
    let totalUpdated = 0;
    let offset = 0;

    while (true) {
      const rows = await prisma.bookkeeperTransaction.findMany({
        where: {
          founderId,
          rawXeroDataEncrypted: null,
          // Prisma Json nullable filter: rows that have a non-null JSONB value
          rawXeroData: { not: Prisma.JsonNull },
        },
        select: {
          id: true,
          rawXeroData: true,
        },
        take: batchSize,
        skip: offset,
        orderBy: { createdAt: 'asc' },
      });

      if (rows.length === 0) break;

      for (const row of rows) {
        const encrypted = encryptXeroPayload(row.rawXeroData as XeroRawPayload);
        if (!encrypted) {
          logger.error(
            '[Bookkeeper] backFillEncryption: encryption failed for row',
            {
              id: row.id,
            }
          );
          continue;
        }

        await prisma.bookkeeperTransaction.update({
          where: { id: row.id },
          data: {
            rawXeroDataEncrypted: encrypted,
            // Null out the plaintext after successfully encrypting
            rawXeroData: Prisma.JsonNull,
            updatedAt: new Date(),
          },
        });

        totalUpdated++;
      }

      offset += batchSize;
    }

    logger.info('[Bookkeeper] backFillEncryption complete', {
      founderId,
      totalUpdated,
    });

    return totalUpdated;
  },
};
