/**
 * SYN-1316 weekly owner voice check-in: questions derive from missing
 * decision-critical facts. Zero is valid when all facts are adequate.
 */
import type { BusinessIntent, OpportunitySignal } from './contracts';
import { businessIntentSchema, opportunitySignalSchema } from './contracts';

export interface OwnerQuestion {
  id: string;
  priority: number;
  text: string;
  purpose: string;
  signalId?: string;
}
export function selectWeeklyQuestions(
  intentInput: BusinessIntent,
  rawSignals: OpportunitySignal[],
  answeredQuestionIds: ReadonlySet<string> = new Set()
): OwnerQuestion[] {
  const intent = businessIntentSchema.parse(intentInput);
  const signals = rawSignals.map(s => opportunitySignalSchema.parse(s));
  if (signals.some(s => s.organizationId !== intent.organizationId)) {
    throw new Error('TENANT_MISMATCH');
  }
  if (signals.some(s => !intent.serviceIds.includes(s.serviceId))) {
    throw new Error('UNKNOWN_SERVICE');
  }
  const candidates: OwnerQuestion[] = [];
  const cap = intent.capacity;
  if (cap.availableJobsPerWeek === null || cap.bookedJobsPerWeek === null) {
    candidates.push({
      id: 'capacity_current',
      priority: 100,
      text: 'How many jobs can your team take next week, and how many are already booked?',
      purpose: 'Avoid sending more work than the business can fulfil.',
    });
  }
  if (
    cap.availableJobsPerWeek !== null &&
    cap.bookedJobsPerWeek !== null &&
    cap.bookedJobsPerWeek > cap.availableJobsPerWeek
  ) {
    candidates.push({
      id: 'capacity_overrun',
      priority: 95,
      text: 'You appear over capacity. Should we focus on future bookings or higher-value work?',
      purpose:
        'Preserve customer trust and margins when demand exceeds capacity.',
    });
  }
  if (intent.constraints.preferredServices.length === 0) {
    candidates.push({
      id: 'service_priorities',
      priority: 80,
      text: 'Which services do you most want to be known for, based on your quality and profitability?',
      purpose: 'Guide customer fit rather than maximising enquiry volume.',
    });
  }
  for (const signal of signals) {
    if (
      signal.confidence < 0.65 ||
      signal.evidence.some(e => e.dataClass === 'estimated')
    ) {
      candidates.push({
        id: `verify_signal:${signal.id}`,
        priority: 70 + Math.round(signal.confidence * 10),
        text: `We're seeing a possible opportunity for ${signal.serviceId}. Are customers actually requesting this service, and what do they value most about it?`,
        purpose: 'Validate an estimated opportunity before altering marketing.',
        signalId: signal.id,
      });
    }
  }
  return candidates
    .filter(q => !answeredQuestionIds.has(q.id))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, 3);
}
