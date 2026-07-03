/**
 * Marketing Agency Agent — Cadence Scheduler.
 *
 * Pure decision function: given the current time and a list of agent
 * cadence rows from the DB, returns the set of agents that are DUE for
 * a run right now. The caller (a cron route) enqueues runs for each.
 *
 * Cadence math:
 *   - cadence='manual'   → never auto-enqueue
 *   - cadence='hourly'   → enqueue if lastRunAt is null OR (lastRunAt + 1h) < now
 *   - cadence='daily'    → enqueue if lastRunAt is null OR (lastRunAt + 24h) < now
 *   - cadence='weekly'   → enqueue if lastRunAt is null OR (lastRunAt + 7d) < now
 *
 * Only agents at status='active' are considered. Paused / archived
 * agents never auto-enqueue.
 *
 * Returns next-run-at timestamps too so the caller can update them.
 *
 * Pure function — DB access lives in the cron route; this file is unit-
 * testable with stub agent rows.
 */

export interface SchedulableAgent {
  id: string;
  organizationId: string;
  createdById: string;
  cadence: string;
  status: string;
  lastRunAt: Date | null;
}

export interface AgentDueResult {
  agentId: string;
  organizationId: string;
  triggeredById: string;
  trigger: 'cadence-hourly' | 'cadence-daily' | 'cadence-weekly';
  nextRunAt: Date;
}

const CADENCE_INTERVAL_MS: Record<string, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

const CADENCE_TRIGGER: Record<string, AgentDueResult['trigger']> = {
  hourly: 'cadence-hourly',
  daily: 'cadence-daily',
  weekly: 'cadence-weekly',
};

/**
 * Decide which agents are due to run right now. Pure function.
 */
export function selectDueAgents(
  agents: SchedulableAgent[],
  now: Date = new Date()
): AgentDueResult[] {
  const due: AgentDueResult[] = [];

  for (const agent of agents) {
    if (agent.status !== 'active') continue;
    const interval = CADENCE_INTERVAL_MS[agent.cadence];
    if (!interval) continue; // 'manual' or unknown cadence — skip

    const isDue =
      agent.lastRunAt === null ||
      agent.lastRunAt.getTime() + interval <= now.getTime();
    if (!isDue) continue;

    due.push({
      agentId: agent.id,
      organizationId: agent.organizationId,
      triggeredById: agent.createdById,
      trigger: CADENCE_TRIGGER[agent.cadence],
      nextRunAt: new Date(now.getTime() + interval),
    });
  }

  return due;
}
