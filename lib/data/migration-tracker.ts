/**
 * Migration Tracker
 * Audit trail and tracking for database migrations
 *
 * @task UNI-431 - Data Migration & Integrity Epic
 *
 * Usage:
 * ```typescript
 * import { MigrationTracker } from '@/lib/data/migration-tracker';
 *
 * const tracker = new MigrationTracker(prisma);
 * const migration = await tracker.startMigration('Add user preferences column');
 *
 * try {
 *   // Perform migration
 *   await tracker.recordStep(migration.id, 'alter_table', 'Adding column...');
 *   await prisma.$executeRaw`ALTER TABLE users ADD COLUMN preferences JSONB`;
 *   await tracker.recordStep(migration.id, 'alter_table', 'Column added', true);
 *
 *   await tracker.completeMigration(migration.id, 'success');
 * } catch (error) {
 *   await tracker.completeMigration(migration.id, 'failed', error.message);
 *   throw error;
 * }
 * ```
 */

import { prisma } from '@/lib/prisma';

// ============================================================================
// TYPES
// ============================================================================

export interface Migration {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  steps: MigrationStep[];
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface MigrationStep {
  id: string;
  migrationId: string;
  type: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  details?: Record<string, unknown>;
}

export interface MigrationSummary {
  total: number;
  successful: number;
  failed: number;
  pending: number;
  recent: Migration[];
}

// ============================================================================
// MIGRATION TRACKER CLASS
// ============================================================================

export class MigrationTracker {
  private migrations: Map<string, Migration> = new Map();
  private persistToDb: boolean;

  constructor(persistToDb: boolean = false) {
    this.persistToDb = persistToDb;
  }

  /**
   * Start tracking a new migration
   */
  async startMigration(
    name: string,
    description?: string,
    metadata?: Record<string, unknown>
  ): Promise<Migration> {
    const id = this.generateId();
    const migration: Migration = {
      id,
      name,
      description,
      status: 'running',
      startedAt: new Date(),
      steps: [],
      metadata,
    };

    this.migrations.set(id, migration);

    // Log start
    console.log(`[Migration ${id}] Starting: ${name}`);

    // Persist to audit log if enabled
    if (this.persistToDb && prisma) {
      try {
        await prisma.auditLog.create({
          data: {
            action: 'migration_started',
            resource: 'migration',
            resourceId: id,
            details: JSON.parse(JSON.stringify({
              name,
              description: description || null,
              metadata: metadata || null,
            })),
          },
        });
      } catch (error) {
        console.warn('[Migration Tracker] Failed to persist audit log:', error);
      }
    }

    return migration;
  }

  /**
   * Record a migration step
   */
  async recordStep(
    migrationId: string,
    type: string,
    description: string,
    completed: boolean = false,
    details?: Record<string, unknown>
  ): Promise<MigrationStep> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    const stepId = this.generateId();
    const step: MigrationStep = {
      id: stepId,
      migrationId,
      type,
      description,
      status: completed ? 'completed' : 'running',
      startedAt: new Date(),
      completedAt: completed ? new Date() : undefined,
      duration: completed ? 0 : undefined,
      details,
    };

    migration.steps.push(step);

    // Log step
    const statusIcon = completed ? '✓' : '...';
    console.log(`[Migration ${migrationId}] ${statusIcon} ${type}: ${description}`);

    return step;
  }

  /**
   * Complete a migration step
   */
  async completeStep(
    migrationId: string,
    stepId: string,
    success: boolean = true,
    details?: Record<string, unknown>
  ): Promise<void> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    const step = migration.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step ${stepId} not found in migration ${migrationId}`);
    }

    step.status = success ? 'completed' : 'failed';
    step.completedAt = new Date();
    step.duration = step.completedAt.getTime() - step.startedAt.getTime();
    if (details) {
      step.details = { ...step.details, ...details };
    }
  }

  /**
   * Complete a migration
   */
  async completeMigration(
    migrationId: string,
    status: 'success' | 'failed' | 'rolled_back',
    errorMessage?: string
  ): Promise<Migration> {
    const migration = this.migrations.get(migrationId);
    if (!migration) {
      throw new Error(`Migration ${migrationId} not found`);
    }

    migration.status = status;
    migration.completedAt = new Date();
    migration.duration = migration.completedAt.getTime() - migration.startedAt.getTime();
    migration.errorMessage = errorMessage;

    // Log completion
    const icon = status === 'success' ? '✅' : status === 'rolled_back' ? '⏪' : '❌';
    console.log(
      `[Migration ${migrationId}] ${icon} Completed with status: ${status} (${migration.duration}ms)`
    );
    if (errorMessage) {
      console.log(`[Migration ${migrationId}] Error: ${errorMessage}`);
    }

    // Persist to audit log
    if (this.persistToDb && prisma) {
      try {
        await prisma.auditLog.create({
          data: {
            action: `migration_${status}`,
            resource: 'migration',
            resourceId: migrationId,
            details: {
              name: migration.name,
              duration: migration.duration,
              stepsCompleted: migration.steps.filter((s) => s.status === 'completed').length,
              totalSteps: migration.steps.length,
              errorMessage,
            },
          },
        });
      } catch (error) {
        console.warn('[Migration Tracker] Failed to persist audit log:', error);
      }
    }

    return migration;
  }

  /**
   * Get migration by ID
   */
  getMigration(id: string): Migration | undefined {
    return this.migrations.get(id);
  }

  /**
   * Get all migrations
   */
  getAllMigrations(): Migration[] {
    return Array.from(this.migrations.values());
  }

  /**
   * Get migration summary
   */
  getSummary(): MigrationSummary {
    const all = this.getAllMigrations();
    return {
      total: all.length,
      successful: all.filter((m) => m.status === 'success').length,
      failed: all.filter((m) => m.status === 'failed').length,
      pending: all.filter((m) => m.status === 'pending' || m.status === 'running').length,
      recent: all.slice(-10).reverse(),
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `mig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

// ============================================================================
// ROLLBACK UTILITIES
// ============================================================================

export interface RollbackPlan {
  migrationId: string;
  steps: RollbackStep[];
}

export interface RollbackStep {
  order: number;
  description: string;
  sql: string;
  riskLevel: 'low' | 'medium' | 'high';
}

/**
 * Create a rollback plan
 */
export function createRollbackPlan(
  migrationId: string,
  steps: Omit<RollbackStep, 'order'>[]
): RollbackPlan {
  return {
    migrationId,
    steps: steps.map((step, index) => ({
      ...step,
      order: index + 1,
    })),
  };
}

/**
 * Execute a rollback plan
 */
export async function executeRollback(
  plan: RollbackPlan,
  tracker: MigrationTracker
): Promise<void> {
  const migration = await tracker.startMigration(
    `Rollback: ${plan.migrationId}`,
    `Rolling back migration ${plan.migrationId}`
  );

  try {
    for (const step of plan.steps) {
      await tracker.recordStep(
        migration.id,
        'rollback',
        step.description,
        false,
        { sql: step.sql, riskLevel: step.riskLevel }
      );

      // Execute rollback SQL
      if (prisma) {
        await prisma.$executeRawUnsafe(step.sql);
      }

      console.log(`  [${step.order}/${plan.steps.length}] ${step.description} ✓`);
    }

    await tracker.completeMigration(migration.id, 'success');
  } catch (error) {
    await tracker.completeMigration(
      migration.id,
      'failed',
      error instanceof Error ? error.message : String(error)
    );
    throw error;
  }
}

// ============================================================================
// DATA SNAPSHOT UTILITIES
// ============================================================================

export interface DataSnapshot {
  id: string;
  createdAt: Date;
  tables: Record<string, number>;
  checksums: Record<string, string>;
}

/**
 * Create a data snapshot for comparison
 */
export async function createDataSnapshot(): Promise<DataSnapshot> {
  const snapshot: DataSnapshot = {
    id: `snap_${Date.now()}`,
    createdAt: new Date(),
    tables: {},
    checksums: {},
  };

  if (!prisma) {
    return snapshot;
  }

  // Get counts for main tables
  const tables = [
    'user',
    'campaign',
    'post',
    'project',
    'platformConnection',
    'notification',
    'auditLog',
  ];

  for (const table of tables) {
    try {
      const count = await (prisma as any)[table].count();
      snapshot.tables[table] = count;

      // Simple checksum based on recent IDs
      const recent = await (prisma as any)[table].findMany({
        take: 100,
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      snapshot.checksums[table] = recent.map((r: any) => r.id).join(',').slice(0, 100);
    } catch {
      snapshot.tables[table] = -1;
    }
  }

  return snapshot;
}

/**
 * Compare two snapshots
 */
export function compareSnapshots(
  before: DataSnapshot,
  after: DataSnapshot
): {
  changes: Array<{ table: string; before: number; after: number; diff: number }>;
  modified: string[];
} {
  const changes: Array<{ table: string; before: number; after: number; diff: number }> = [];
  const modified: string[] = [];

  for (const table of Object.keys(before.tables)) {
    const beforeCount = before.tables[table];
    const afterCount = after.tables[table] ?? beforeCount;
    const diff = afterCount - beforeCount;

    if (diff !== 0) {
      changes.push({ table, before: beforeCount, after: afterCount, diff });
    }

    if (before.checksums[table] !== after.checksums[table]) {
      modified.push(table);
    }
  }

  return { changes, modified };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const migrationTracker = new MigrationTracker(true);

export default MigrationTracker;
