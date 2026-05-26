/**
 * In-house agency task catalog (AT-001–AT-032).
 * Source of truth for product wiring; mirrors docs/pm/agency-task-catalog.md.
 * @see SYN-972 / Phase 128
 */

import type { TaskType } from '@/components/tasks/types';

export const AGENCY_TASK_ID_PATTERN = /^AT-(0[0-9]{2}|[12][0-9]|3[0-2])$/;

export interface AgencyTaskDefinition {
  id: string;
  label: string;
  serviceLine: string;
  ceoTop15: boolean;
  /** Maps to Task.category / UI TaskType */
  defaultTaskType: TaskType;
  owningSkills: string[];
}

export const AGENCY_TASK_IDS = Array.from(
  { length: 32 },
  (_, i) => `AT-${String(i + 1).padStart(3, '0')}`
);

export type AgencyTaskId = (typeof AGENCY_TASK_IDS)[number];

export const CEO_TOP_15_IDS: AgencyTaskId[] = [
  'AT-001',
  'AT-002',
  'AT-003',
  'AT-004',
  'AT-005',
  'AT-009',
  'AT-010',
  'AT-011',
  'AT-006',
  'AT-007',
  'AT-008',
  'AT-012',
  'AT-013',
  'AT-014',
  'AT-015',
];

/** Full catalog — labels aligned to docs/pm/agency-task-catalog.md */
export const AGENCY_TASK_CATALOG: AgencyTaskDefinition[] = [
  {
    id: 'AT-001',
    label: 'Orchestration — skill chain assignment',
    serviceLine: 'Orchestration',
    ceoTop15: true,
    defaultTaskType: 'campaign',
    owningSkills: ['senior-strategist'],
  },
  {
    id: 'AT-002',
    label: 'Copy — platform-native draft',
    serviceLine: 'Copy',
    ceoTop15: true,
    defaultTaskType: 'content',
    owningSkills: [
      'senior-copywriter',
      'brand-voice-enforce',
      'senior-strategist',
    ],
  },
  {
    id: 'AT-003',
    label: 'Copy gate — brand-voice enforce',
    serviceLine: 'Copy gate',
    ceoTop15: true,
    defaultTaskType: 'content',
    owningSkills: ['brand-voice-enforce'],
  },
  {
    id: 'AT-004',
    label: 'Strategy queue — CEO batch',
    serviceLine: 'Strategy queue',
    ceoTop15: true,
    defaultTaskType: 'campaign',
    owningSkills: ['senior-strategist'],
  },
  {
    id: 'AT-005',
    label: 'Reporting — Tier-1 weekly',
    serviceLine: 'Reporting',
    ceoTop15: true,
    defaultTaskType: 'analytics',
    owningSkills: ['performance-attribution-lead', 'analytics-lead'],
  },
  {
    id: 'AT-006',
    label: 'Reporting — daily snapshot',
    serviceLine: 'Reporting',
    ceoTop15: true,
    defaultTaskType: 'analytics',
    owningSkills: ['performance-attribution-lead'],
  },
  {
    id: 'AT-007',
    label: 'Reporting — monthly brief',
    serviceLine: 'Reporting',
    ceoTop15: true,
    defaultTaskType: 'analytics',
    owningSkills: ['performance-attribution-lead'],
  },
  {
    id: 'AT-008',
    label: 'Reporting — quarterly review',
    serviceLine: 'Reporting',
    ceoTop15: true,
    defaultTaskType: 'analytics',
    owningSkills: ['performance-attribution-lead', 'senior-cmo'],
  },
  {
    id: 'AT-009',
    label: 'Brand voice — register change',
    serviceLine: 'Brand voice',
    ceoTop15: true,
    defaultTaskType: 'content',
    owningSkills: ['brand-strategist'],
  },
  {
    id: 'AT-010',
    label: 'Creative — Remotion / visual brief',
    serviceLine: 'Creative',
    ceoTop15: true,
    defaultTaskType: 'design',
    owningSkills: ['creative-director'],
  },
  {
    id: 'AT-011',
    label: 'CRO — single-variable test',
    serviceLine: 'CRO',
    ceoTop15: true,
    defaultTaskType: 'campaign',
    owningSkills: ['cro-specialist'],
  },
  {
    id: 'AT-012',
    label: 'Email — sequence / trigger',
    serviceLine: 'Email',
    ceoTop15: true,
    defaultTaskType: 'campaign',
    owningSkills: ['email-specialist'],
  },
  {
    id: 'AT-013',
    label: 'Insights — audience refresh',
    serviceLine: 'Insights',
    ceoTop15: true,
    defaultTaskType: 'analytics',
    owningSkills: ['customer-insights-lead'],
  },
  {
    id: 'AT-014',
    label: 'PR / comms — launch or crisis',
    serviceLine: 'PR / comms',
    ceoTop15: true,
    defaultTaskType: 'content',
    owningSkills: ['pr-communications-lead'],
  },
  {
    id: 'AT-015',
    label: 'Local SEO — GBP / schema',
    serviceLine: 'Local SEO',
    ceoTop15: true,
    defaultTaskType: 'analytics',
    owningSkills: ['local-seo-geo-veteran'],
  },
  {
    id: 'AT-016',
    label: 'Paid — pilot test design',
    serviceLine: 'Paid',
    ceoTop15: false,
    defaultTaskType: 'campaign',
    owningSkills: ['paid-performance-marketer'],
  },
  {
    id: 'AT-017',
    label: 'Ops / data — infra change',
    serviceLine: 'Ops / data',
    ceoTop15: false,
    defaultTaskType: 'other',
    owningSkills: ['marketing-operations-director'],
  },
  {
    id: 'AT-018',
    label: 'Research — external signal',
    serviceLine: 'Research',
    ceoTop15: false,
    defaultTaskType: 'other',
    owningSkills: ['research-lead'],
  },
  {
    id: 'AT-019',
    label: 'Foundation — gate flip request',
    serviceLine: 'Foundation',
    ceoTop15: false,
    defaultTaskType: 'other',
    owningSkills: ['foundation-keeper'],
  },
  {
    id: 'AT-020',
    label: 'Platform adapt — multi-platform',
    serviceLine: 'Platform adapt',
    ceoTop15: false,
    defaultTaskType: 'social',
    owningSkills: ['platform-content-adaptor'],
  },
  {
    id: 'AT-021',
    label: 'Platform score — pre-publish',
    serviceLine: 'Platform score',
    ceoTop15: false,
    defaultTaskType: 'social',
    owningSkills: ['platform-content-optimiser'],
  },
  {
    id: 'AT-022',
    label: 'CMO — quarterly portfolio',
    serviceLine: 'CMO',
    ceoTop15: false,
    defaultTaskType: 'campaign',
    owningSkills: ['senior-cmo'],
  },
  {
    id: 'AT-023',
    label: 'Retention — cohort review',
    serviceLine: 'Retention',
    ceoTop15: false,
    defaultTaskType: 'analytics',
    owningSkills: ['client-retention'],
  },
  {
    id: 'AT-024',
    label: 'CCW boundary — cross-portfolio',
    serviceLine: 'CCW boundary',
    ceoTop15: false,
    defaultTaskType: 'campaign',
    owningSkills: ['senior-strategist'],
  },
  {
    id: 'AT-025',
    label: 'Incident — canary AMBER/RED',
    serviceLine: 'Incident',
    ceoTop15: false,
    defaultTaskType: 'analytics',
    owningSkills: ['performance-attribution-lead', 'senior-strategist'],
  },
  {
    id: 'AT-026',
    label: 'Advisor brief — weekly cron',
    serviceLine: 'Advisor brief',
    ceoTop15: false,
    defaultTaskType: 'campaign',
    owningSkills: ['(product) advisor pipeline'],
  },
  {
    id: 'AT-027',
    label: 'Autonomous NL — campaign describe',
    serviceLine: 'Autonomous NL',
    ceoTop15: false,
    defaultTaskType: 'campaign',
    owningSkills: ['(product) autonomous page'],
  },
  {
    id: 'AT-028',
    label: 'Content campaign — workflow run',
    serviceLine: 'Content campaign',
    ceoTop15: false,
    defaultTaskType: 'content',
    owningSkills: ['contentCampaignWorkflow'],
  },
  {
    id: 'AT-029',
    label: 'Tasks board — PM task CRUD',
    serviceLine: 'Tasks board',
    ceoTop15: false,
    defaultTaskType: 'other',
    owningSkills: ['(product) tasks UI'],
  },
  {
    id: 'AT-030',
    label: 'Tenant ops — portfolio onboarding',
    serviceLine: 'Tenant ops',
    ceoTop15: false,
    defaultTaskType: 'other',
    owningSkills: ['(product) + DB'],
  },
  {
    id: 'AT-031',
    label: 'Social publish — scheduled post',
    serviceLine: 'Social publish',
    ceoTop15: false,
    defaultTaskType: 'social',
    owningSkills: ['scheduler + OAuth'],
  },
  {
    id: 'AT-032',
    label: 'Video — God Mode / pipeline',
    serviceLine: 'Video',
    ceoTop15: false,
    defaultTaskType: 'design',
    owningSkills: ['video-engine'],
  },
];

const catalogById = new Map(AGENCY_TASK_CATALOG.map(t => [t.id, t]));

export function isAgencyTaskId(value: string): value is AgencyTaskId {
  return (
    AGENCY_TASK_ID_PATTERN.test(value) &&
    AGENCY_TASK_IDS.includes(value as AgencyTaskId)
  );
}

export function getAgencyTask(id: string): AgencyTaskDefinition | undefined {
  if (!isAgencyTaskId(id)) return undefined;
  return catalogById.get(id);
}

export function listAgencyTasks(opts?: {
  ceoTop15Only?: boolean;
}): AgencyTaskDefinition[] {
  if (opts?.ceoTop15Only) {
    return CEO_TOP_15_IDS.map(id => catalogById.get(id)!);
  }
  return [...AGENCY_TASK_CATALOG];
}
