/**
 * Quick Access Storyboard · single source of truth for the item registry.
 *
 * Mirrors the categorised structure of ~/Desktop/Synthex-Quick-Access/.
 * The desktop folder is the markdown view. The Quick Access page is the
 * visual view. Both read from the same conceptual model.
 */

export type ItemStatus =
  | 'approval-needed'
  | 'changes-required'
  | 'human-action'
  | 'reference'
  | 'live-link';

export type ItemKind =
  | 'launch-package'
  | 'copy'
  | 'storyboard'
  | 'curriculum'
  | 'evidence'
  | 'runbook'
  | 'discipline'
  | 'verification'
  | 'setup'
  | 'recording'
  | 'handoff'
  | 'debug'
  | 'authoring'
  | 'link';

export interface QuickAccessItem {
  id: string;
  status: ItemStatus;
  kind: ItemKind;
  title: string;
  summary: string;
  timeCostMin?: number; // estimated minutes — undefined for reference / link
  linearTicket?: string; // e.g. "SYN-915"
  vaultPath?: string; // path inside ~/Synthex-Brain-2 or ~/Desktop/Synthex-Quick-Access
  externalUrl?: string;
  brandSlug?: 'ra' | 'dr' | 'nrpg' | 'carsi' | 'synthex' | 'portfolio';
  highlight?: boolean; // featured / top-of-pile
  badges?: string[]; // free-form short tags
}

// ── 01 · APPROVAL NEEDED ────────────────────────────────────────────────────

const APPROVAL_NEEDED: QuickAccessItem[] = [
  {
    id: 'ra-launch-package',
    status: 'approval-needed',
    kind: 'launch-package',
    title: 'RestoreAssist launch package',
    summary:
      'Full audit · all waves · positioning · ICP · channels · copy · runbook · evidence · E-E-A-T',
    timeCostMin: 5,
    linearTicket: 'SYN-915',
    vaultPath: '02-Projects/RA-2026-05-AppStore-Launch/_kickoff.md',
    brandSlug: 'ra',
    highlight: true,
    badges: ['sub-tickets', 'voice-PASS'],
  },
  {
    id: 'insurer-landing',
    status: 'approval-needed',
    kind: 'copy',
    title: 'Insurer-facing landing copy',
    summary: 'Sections · counter-intuitive first-segment proof surface',
    timeCostMin: 8,
    linearTicket: 'SYN-918',
    vaultPath: '02-Projects/RA-2026-05-AppStore-Launch/copy/insurer-landing.md',
    brandSlug: 'ra',
    badges: ['hero', 'CTA'],
  },
  {
    id: 'email-sequence',
    status: 'approval-needed',
    kind: 'copy',
    title: 'Email sequence',
    summary: 'Day-by-day drip · the mid-sequence email has a hold-or-skip rule',
    timeCostMin: 10,
    linearTicket: 'SYN-919',
    vaultPath: '02-Projects/RA-2026-05-AppStore-Launch/copy/email-sequence.md',
    brandSlug: 'ra',
    badges: ['plain reading level', 'drip'],
  },
  {
    id: 'linkedin-drumbeat',
    status: 'approval-needed',
    kind: 'copy',
    title: 'LinkedIn drumbeat',
    summary: 'Founder + brand pieces · fallbacks specced',
    timeCostMin: 15,
    linearTicket: 'SYN-920',
    vaultPath:
      '02-Projects/RA-2026-05-AppStore-Launch/copy/linkedin-drumbeat.md',
    brandSlug: 'ra',
    badges: ['launch window', 'fallbacks ready'],
  },
  {
    id: 'launch-runbook',
    status: 'approval-needed',
    kind: 'runbook',
    title: 'Launch runbook',
    summary: 'Launch calendar · drops · decision gates · kill criteria',
    timeCostMin: 8,
    linearTicket: 'SYN-922',
    vaultPath: '02-Projects/RA-2026-05-AppStore-Launch/runbook.md',
    brandSlug: 'ra',
    badges: ['Standard tier'],
  },
  {
    id: 'evidence-base',
    status: 'approval-needed',
    kind: 'evidence',
    title: 'Evidence base (AU + NZ data)',
    summary: 'Verified-public sources · SVG figures · submissible',
    timeCostMin: 12,
    linearTicket: 'SYN-924',
    vaultPath:
      '02-Projects/RA-2026-05-AppStore-Launch/research/evidence-base.md',
    brandSlug: 'ra',
    badges: ['hard-strict sourcing', '⚠ flags pending'],
  },
  {
    id: 'ra-training-curriculum',
    status: 'approval-needed',
    kind: 'curriculum',
    title: 'RestoreAssist training curriculum',
    summary: 'Videos in tiers (Getting Started · Core · Advanced)',
    timeCostMin: 6,
    linearTicket: 'SYN-925a',
    vaultPath: '02-Projects/training-videos-2026-05/curricula/ra-curriculum.md',
    brandSlug: 'ra',
    badges: ['curriculum'],
  },
  {
    id: 'byok-shared-module',
    status: 'approval-needed',
    kind: 'curriculum',
    title: 'BYOK shared module (cross-brand)',
    summary: 'Shared templates across brands',
    timeCostMin: 5,
    linearTicket: 'SYN-925e',
    vaultPath:
      '02-Projects/training-videos-2026-05/curricula/byok-shared-module.md',
    brandSlug: 'portfolio',
    badges: ['cross-brand'],
  },
  {
    id: 'training-pilot-storyboard',
    status: 'approval-needed',
    kind: 'storyboard',
    title: 'Training pilot · RA · BYOK setup ⭐',
    summary:
      'Shot list · per-scene voiceover script · per-scene voice-enforce check',
    timeCostMin: 12,
    linearTicket: 'SYN-925a',
    vaultPath:
      '02-Projects/training-videos-2026-05/ra/byok-setup/storyboard.md',
    brandSlug: 'ra',
    highlight: true,
    badges: ['pilot', 'unlocks the remaining videos'],
  },
];

// ── 02 · CHANGES REQUIRED ────────────────────────────────────────────────────

const CHANGES_REQUIRED: QuickAccessItem[] = [
  {
    id: 'verify-senate-inquiry',
    status: 'changes-required',
    kind: 'verification',
    title: 'Senate Inquiry · cycle-time figures',
    summary:
      '"Flood failure to future fairness" Oct 2024 · pull cycle-time + complaint-volume data',
    timeCostMin: 45,
    externalUrl:
      'https://www.aph.gov.au/Parliamentary_Business/Committees/House/Economics',
    brandSlug: 'ra',
    badges: ['evidence-base §1.1'],
  },
  {
    id: 'verify-afca-fy24',
    status: 'changes-required',
    kind: 'verification',
    title: 'AFCA FY24 Annual Review',
    summary:
      'Pull the top complaint reasons and their shares for general insurance',
    timeCostMin: 20,
    externalUrl: 'https://www.afca.org.au/about-afca/publications',
    brandSlug: 'ra',
    badges: ['evidence-base §3.3'],
  },
  {
    id: 'verify-asnzs-mould',
    status: 'changes-required',
    kind: 'verification',
    title: 'AS/NZS 4849.1 mould remediation',
    summary: 'Confirm exact title + current edition of the AU/NZ standard',
    timeCostMin: 10,
    externalUrl: 'https://www.standards.org.au/',
    brandSlug: 'ra',
    badges: ['evidence-base §4.2'],
  },
  {
    id: 'verify-reinspection-figure',
    status: 'changes-required',
    kind: 'verification',
    title: 'Re-inspection rate figure',
    summary:
      'Source it OR replace with the structural argument (already drafted)',
    timeCostMin: 30,
    brandSlug: 'ra',
    badges: ['LinkedIn T+4 carousel', 'founder T+1', 'video Scene 2'],
  },
  {
    id: 'verify-cost-figure',
    status: 'changes-required',
    kind: 'verification',
    title: 'Per-inspection cost figure',
    summary:
      'Verify against Anthropic per-token pricing × typical RA inspection token usage',
    timeCostMin: 15,
    externalUrl: 'https://www.anthropic.com/pricing',
    brandSlug: 'ra',
    badges: ['pilot Scene 8'],
  },
];

// ── 03 · HUMAN ACTION REQUIRED ──────────────────────────────────────────────

const HUMAN_ACTION: QuickAccessItem[] = [
  {
    id: 'spawn-task-blocker',
    status: 'human-action',
    kind: 'debug',
    title: 'Investigate spawn-task client issue',
    summary:
      'Single fix unblocks ALL future cross-repo Pi-CEO work · restart Claude Code · check version · check MCP health',
    timeCostMin: 15,
    vaultPath:
      '~/Desktop/Synthex-Quick-Access/03-HUMAN-ACTION/spawn-task-blocker.md',
    brandSlug: 'portfolio',
    highlight: true,
    badges: ['CRITICAL ENABLER', 'unblocks Pi-CEO'],
  },
  {
    id: 'screen-capture-pilot',
    status: 'human-action',
    kind: 'recording',
    title: 'Record screen-capture: RA · BYOK setup',
    summary:
      'Pilot for the entire training-video system · scenes · recording time',
    timeCostMin: 45,
    vaultPath:
      '~/Desktop/Synthex-Quick-Access/03-HUMAN-ACTION/screen-capture-pilot.md',
    brandSlug: 'ra',
    badges: ['unlocks pilot render', 'scenes'],
  },
  {
    id: 'pi-ceo-video-handoff',
    status: 'human-action',
    kind: 'handoff',
    title: 'Paste Pi-CEO video render brief',
    summary:
      'Open Pi-CEO Claude Code session · paste brief · runs autonomously',
    timeCostMin: 5,
    vaultPath:
      '~/Desktop/Synthex-Quick-Access/03-HUMAN-ACTION/pi-ceo-video-render-handoff.md',
    brandSlug: 'ra',
    badges: ['unblocks SYN-921'],
  },
  {
    id: 'linkedin-founder-posts',
    status: 'human-action',
    kind: 'authoring',
    title: 'Edit + post the founder LinkedIn drafts',
    summary:
      'Origin post · reflection post · founder voice tag · placeholder claims need verifying',
    timeCostMin: 30,
    vaultPath:
      '~/Desktop/Synthex-Quick-Access/03-HUMAN-ACTION/linkedin-founder-posts.md',
    brandSlug: 'ra',
    badges: ['founder voice', 'posts'],
  },
  {
    id: 'obsidian-vault-setup',
    status: 'human-action',
    kind: 'setup',
    title: 'Open Synthex-Brain-2 in Obsidian',
    summary:
      'One-time vault setup · adds graph view across portfolio operations',
    timeCostMin: 3,
    vaultPath:
      '~/Desktop/Synthex-Quick-Access/03-HUMAN-ACTION/obsidian-vault-setup.md',
    brandSlug: 'portfolio',
    badges: ['one-time'],
  },
  {
    id: 'web-clipper-config',
    status: 'human-action',
    kind: 'setup',
    title: 'Configure Web Clipper destination',
    summary: 'Land clips at 00-Inbox/Clips/ with the right template',
    timeCostMin: 3,
    vaultPath:
      '~/Desktop/Synthex-Quick-Access/03-HUMAN-ACTION/obsidian-vault-setup.md',
    brandSlug: 'portfolio',
    badges: ['one-time'],
  },
];

// ── 04 · REFERENCE ──────────────────────────────────────────────────────────

const REFERENCE: QuickAccessItem[] = [
  {
    id: 'seo-aeo-geo-eeat',
    status: 'reference',
    kind: 'discipline',
    title: 'SEO / AEO / GEO / E-E-A-T discipline',
    summary:
      'Portfolio-wide · audit checklist · YMYL rules · Google Helpful Content alignment',
    vaultPath: '_meta/seo-aeo-geo-eeat-discipline.md',
    brandSlug: 'portfolio',
    badges: ['always-on'],
  },
  {
    id: 'training-video-discipline',
    status: 'reference',
    kind: 'discipline',
    title: 'Training video discipline',
    summary:
      'Portfolio-wide · length tiers · pre-render checklist · production runbook',
    vaultPath: '_meta/training-video-discipline.md',
    brandSlug: 'portfolio',
    badges: ['always-on'],
  },
  {
    id: 'vault-connections',
    status: 'reference',
    kind: 'discipline',
    title: 'Vault connections + topology',
    summary:
      'Pi-CEO ↔ Brain-2 ↔ Synthex symlink topology · read/write rules · data flow',
    vaultPath: '_meta/connections.md',
    brandSlug: 'portfolio',
    badges: ['short', 'living-doc'],
  },
  {
    id: 'vault-conventions',
    status: 'reference',
    kind: 'discipline',
    title: 'Vault conventions',
    summary:
      'File naming · YAML frontmatter · status lifecycle · Pi-CEO write rules',
    vaultPath: '_meta/conventions.md',
    brandSlug: 'portfolio',
    badges: ['short', 'living-doc'],
  },
];

// ── 05 · LIVE LINKS ─────────────────────────────────────────────────────────

const LIVE_LINKS: QuickAccessItem[] = [
  {
    id: 'vision-board-prod',
    status: 'live-link',
    kind: 'link',
    title: 'Vision Board · production',
    summary: 'Auth-gated · /dashboard/admin/vision-board/ra-launch-2026-05',
    externalUrl: '/dashboard/admin/vision-board/ra-launch-2026-05',
    brandSlug: 'ra',
    badges: ['internal'],
  },
  {
    id: 'vision-board-preview',
    status: 'live-link',
    kind: 'link',
    title: 'Vision Board · preview (no auth)',
    summary: '/vision-board-preview/ra-launch-2026-05',
    externalUrl: '/vision-board-preview/ra-launch-2026-05',
    brandSlug: 'ra',
    badges: ['no-auth'],
  },
  {
    id: 'linear-syn-915',
    status: 'live-link',
    kind: 'link',
    title: 'Linear · RA launch parent (SYN-915)',
    summary: 'Sub-tickets · launch package',
    externalUrl: 'https://linear.app/unite-group/issue/SYN-915',
    brandSlug: 'ra',
    badges: ['Linear'],
  },
  {
    id: 'linear-syn-925',
    status: 'live-link',
    kind: 'link',
    title: 'Linear · Training videos parent (SYN-925)',
    summary: 'Sub-tickets · brands + BYOK shared',
    externalUrl: 'https://linear.app/unite-group/issue/SYN-925',
    brandSlug: 'portfolio',
    badges: ['Linear'],
  },
  {
    id: 'platform-synthex',
    status: 'live-link',
    kind: 'link',
    title: 'Supabase · Synthex production',
    summary: 'znyjoyjsvjotlzjppzal · video tables · Prisma schema source',
    externalUrl: 'https://platform.com/dashboard/project/znyjoyjsvjotlzjppzal',
    brandSlug: 'synthex',
    badges: ['Supabase'],
  },
  {
    id: 'platform-ra',
    status: 'live-link',
    kind: 'link',
    title: 'Supabase · RestoreAssist production',
    summary: 'oxeiaavuspvpvanzcrjc · live RA app database',
    externalUrl: 'https://platform.com/dashboard/project/oxeiaavuspvpvanzcrjc',
    brandSlug: 'ra',
    badges: ['Supabase'],
  },
];

// ── Public registry ─────────────────────────────────────────────────────────

export const QUICK_ACCESS_LANES: Array<{
  status: ItemStatus;
  label: string;
  description: string;
  emoji: string;
  items: QuickAccessItem[];
}> = [
  {
    status: 'approval-needed',
    label: 'Approval needed',
    description: 'Clean and verified · waiting for your sign-off',
    emoji: '🟠',
    items: APPROVAL_NEEDED,
  },
  {
    status: 'changes-required',
    label: 'Changes required',
    description:
      'Verification flags · source the figure or use the structural fallback',
    emoji: '🟡',
    items: CHANGES_REQUIRED,
  },
  {
    status: 'human-action',
    label: 'Human action',
    description: 'Things only you can do',
    emoji: '🔵',
    items: HUMAN_ACTION,
  },
  {
    status: 'reference',
    label: 'Reference',
    description:
      'Always-on discipline docs · read before authoring in the named area',
    emoji: '⚪️',
    items: REFERENCE,
  },
  {
    status: 'live-link',
    label: 'Live links',
    description: 'Quick jumps to running surfaces',
    emoji: '🌐',
    items: LIVE_LINKS,
  },
];
