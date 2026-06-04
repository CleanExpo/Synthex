import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prisma from '../lib/prisma';
import type { CalendarSlot, ContentCalendarData } from '../lib/calendar/types';
import { runSafetyChecks } from '../lib/publish/safetyChecks';
import { isCcwEofyPublishingSlot } from '../lib/marketing-agency/ccw-eofy-publishing-package';
import { CCW_EOFY_CAMPAIGN_NAME } from '../lib/marketing-agency/ccw-eofy-calendar';

const SCRATCHPAD_DIR = path.resolve(process.cwd(), '.claude/scratchpad');
const JSON_PATH = path.join(SCRATCHPAD_DIR, 'ccw-publish-execution-demo.json');
const HTML_PATH = path.join(SCRATCHPAD_DIR, 'ccw-publish-execution-demo.html');
const MARKDOWN_PATH = path.join(SCRATCHPAD_DIR, 'ccw-publish-execution-demo.md');

type GateStatus = 'ready' | 'blocked' | 'manual' | 'not_queued';

interface DemoQueueItem {
  id: string;
  slotId: string;
  platform: string;
  scheduledAt: string;
  status: string;
  safetyGate: {
    status: GateStatus;
    failedGate: string | null;
    reason: string | null;
  };
}

interface DemoSlot {
  id: string;
  platform: string;
  scheduledAt: string;
  status: string;
  title: string;
  queueStatus: string;
}

interface DemoWeek {
  calendarId: string;
  weekStart: string;
  weekEnd: string;
  slots: DemoSlot[];
}

function asContentCalendarData(value: unknown): ContentCalendarData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { slots: [] } as unknown as ContentCalendarData;
  }

  const data = value as Partial<ContentCalendarData>;
  return {
    ...data,
    slots: Array.isArray(data.slots) ? data.slots : [],
  } as ContentCalendarData;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slotTitle(slot: CalendarSlot & Record<string, unknown>): string {
  const explicitTitle = slot.title ?? slot.topic ?? slot.theme;
  if (explicitTitle) return String(explicitTitle);
  const caption = slot.captions?.[slot.selectedCaption ?? 0] ?? slot.captions?.[0];
  return caption ? String(caption).slice(0, 90) : slot.id;
}

function gateLabel(item: DemoQueueItem): string {
  if (item.safetyGate.status === 'ready') return 'Ready after gates';
  if (item.safetyGate.status === 'manual') return 'Manual channel';
  if (item.safetyGate.status === 'not_queued') return 'Calendar only';
  return `Blocked: ${item.safetyGate.failedGate ?? 'unknown'}`;
}

async function buildDemo() {
  const org = await prisma.organization.findUnique({
    where: { slug: 'ccw' },
    select: { id: true, name: true, slug: true, calendarMode: true },
  });
  if (!org) throw new Error('CCW organization not found');

  const campaign = await prisma.campaign.findFirst({
    where: {
      organizationId: org.id,
      name: CCW_EOFY_CAMPAIGN_NAME,
      deletedAt: null,
    },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, status: true, settings: true },
  });
  if (!campaign) throw new Error(`Campaign not found: ${CCW_EOFY_CAMPAIGN_NAME}`);

  const calendars = await prisma.contentCalendar.findMany({
    where: {
      organizationId: org.id,
      weekStart: {
        gte: new Date('2026-06-01T00:00:00.000Z'),
        lte: new Date('2026-06-29T00:00:00.000Z'),
      },
    },
    orderBy: { weekStart: 'asc' },
    select: {
      id: true,
      weekStart: true,
      weekEnd: true,
      slots: true,
    },
  });

  const queueItems = await prisma.publishQueueItem.findMany({
    where: {
      organizationId: org.id,
      slotId: { startsWith: 'ccw-eofy-2026-' },
      status: { in: ['pending', 'failed', 'held', 'publishing', 'published'] },
    },
    orderBy: [{ scheduledAt: 'asc' }, { platform: 'asc' }],
    select: {
      id: true,
      calendarId: true,
      slotId: true,
      platform: true,
      scheduledAt: true,
      status: true,
      lastError: true,
    },
  });
  const queueBySlot = new Map(queueItems.map(item => [item.slotId, item]));

  const weeks: DemoWeek[] = calendars.map(calendar => {
    const data = asContentCalendarData(calendar.slots);
    const slots = (data.slots as (CalendarSlot & Record<string, unknown>)[])
      .filter(isCcwEofyPublishingSlot)
      .map(slot => {
        const queueItem = queueBySlot.get(slot.id);
        return {
          id: slot.id,
          platform: slot.platform,
          scheduledAt: String(slot.scheduledAt),
          status: String(slot.status ?? 'draft'),
          title: slotTitle(slot),
          queueStatus: queueItem?.status ?? 'manual_or_not_queued',
        };
      });

    return {
      calendarId: calendar.id,
      weekStart: calendar.weekStart.toISOString().slice(0, 10),
      weekEnd: calendar.weekEnd.toISOString().slice(0, 10),
      slots,
    };
  });

  const dryRunQueue: DemoQueueItem[] = [];
  for (const item of queueItems) {
    const safety = await runSafetyChecks({
      organizationId: org.id,
      calendarId: item.calendarId,
      slotId: item.slotId,
      platform: item.platform,
    });

    dryRunQueue.push({
      id: item.id,
      slotId: item.slotId,
      platform: item.platform,
      scheduledAt: item.scheduledAt.toISOString(),
      status: item.status,
      safetyGate: {
        status: safety.pass ? 'ready' : 'blocked',
        failedGate: safety.failedGate ?? null,
        reason: safety.reason ?? item.lastError ?? null,
      },
    });
  }

  const queuedSlotIds = new Set(queueItems.map(item => item.slotId));
  const manualSlots = weeks
    .flatMap(week => week.slots)
    .filter(slot => slot.platform === 'reddit' || !queuedSlotIds.has(slot.id));

  const gateCounts = dryRunQueue.reduce<Record<string, number>>((acc, item) => {
    const key = item.safetyGate.failedGate ?? item.safetyGate.status;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const feedbackLoop = {
    status: 'sandbox_pending_publish_results',
    currentLearningSource: 'scheduled queue plus safety-gate dry run',
    writesAfterLivePublish: [
      'published platform URLs',
      'UTM performance by slot',
      'engagement and sales signal summary',
      'claim or creative lessons learned',
      'next campaign ideas for Synthex and Obsidian',
    ],
    nextBatchRule:
      dryRunQueue.some(item => item.safetyGate.status === 'blocked')
        ? 'Resolve blocked safety gates before live dispatch, while generation continues for the next CCW batch.'
        : 'Run approval-gated live dispatch, then feed measured results into the next CCW batch.',
  };

  const demo = {
    generatedAt: new Date().toISOString(),
    mode: 'sandbox_dry_run_no_external_publish',
    organization: org,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      packageStatus:
        (campaign.settings as Record<string, unknown> | null | undefined)
          ?.ccwEofyPublishingPackage &&
        typeof (campaign.settings as Record<string, unknown>)
          .ccwEofyPublishingPackage === 'object'
          ? ((campaign.settings as Record<string, unknown>)
              .ccwEofyPublishingPackage as Record<string, unknown>).status
          : null,
    },
    summary: {
      calendarWeeks: weeks.length,
      approvedSlots: weeks.reduce((total, week) => total + week.slots.length, 0),
      queuedItems: queueItems.length,
      supportedPlatformQueuedItems: dryRunQueue.length,
      manualOrNotQueuedSlots: manualSlots.length,
      gateCounts,
    },
    weeks,
    dryRunQueue,
    manualSlots,
    feedbackLoop,
  };

  return demo;
}

function renderMarkdown(demo: Awaited<ReturnType<typeof buildDemo>>): string {
  const blocked = demo.dryRunQueue.filter(item => item.safetyGate.status === 'blocked');
  const ready = demo.dryRunQueue.filter(item => item.safetyGate.status === 'ready');

  return `# CCW Publish Execution Lane Sandbox Demo

Generated: ${demo.generatedAt}

Mode: ${demo.mode}

## Package

- Organization: ${demo.organization.name} (${demo.organization.slug})
- Campaign: ${demo.campaign.name}
- Campaign package status: ${demo.campaign.packageStatus ?? 'not set'}
- Calendar mode: ${demo.organization.calendarMode}
- Calendar weeks: ${demo.summary.calendarWeeks}
- Approved CCW slots: ${demo.summary.approvedSlots}
- Queue items: ${demo.summary.queuedItems}
- Manual/not queued slots: ${demo.summary.manualOrNotQueuedSlots}

## Dry-Run Publish Gates

- Ready after all gates: ${ready.length}
- Blocked before live dispatch: ${blocked.length}
- Gate counts: ${JSON.stringify(demo.summary.gateCounts)}

## Feedback Loop

${demo.feedbackLoop.nextBatchRule}

## Artifacts

- JSON: ${JSON_PATH}
- HTML: ${HTML_PATH}
`;
}

function renderHtml(demo: Awaited<ReturnType<typeof buildDemo>>): string {
  const queueRows = demo.dryRunQueue
    .map(
      item => `<tr>
        <td>${escapeHtml(item.scheduledAt.slice(0, 16).replace('T', ' '))}</td>
        <td>${escapeHtml(item.platform)}</td>
        <td>${escapeHtml(item.status)}</td>
        <td>${escapeHtml(gateLabel(item))}</td>
        <td>${escapeHtml(item.safetyGate.reason ?? '')}</td>
      </tr>`
    )
    .join('\n');

  const weekCards = demo.weeks
    .map(
      week => `<section>
        <h2>${escapeHtml(week.weekStart)} to ${escapeHtml(week.weekEnd)}</h2>
        <div class="slots">
          ${week.slots
            .map(
              slot => `<article>
                <strong>${escapeHtml(slot.platform)}</strong>
                <span>${escapeHtml(slot.scheduledAt.slice(0, 16).replace('T', ' '))}</span>
                <p>${escapeHtml(slot.title)}</p>
                <small>${escapeHtml(slot.queueStatus)}</small>
              </article>`
            )
            .join('\n')}
        </div>
      </section>`
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>CCW Publish Execution Lane Sandbox Demo</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111313;
      color: #f3f0e8;
    }
    body { margin: 0; padding: 32px; }
    main { max-width: 1180px; margin: 0 auto; display: grid; gap: 24px; }
    header { display: grid; gap: 10px; border-bottom: 1px solid #343735; padding-bottom: 20px; }
    h1 { font-size: 30px; margin: 0; letter-spacing: 0; }
    h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: 0; }
    p { color: #c8c1b3; line-height: 1.5; margin: 0; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .metric, section, article { border: 1px solid #343735; border-radius: 6px; background: #181b1a; }
    .metric { padding: 14px; }
    .metric span { display: block; color: #9d9586; font-size: 12px; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 6px; font-size: 22px; }
    section { padding: 18px; }
    .slots { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
    article { padding: 12px; display: grid; gap: 6px; }
    article strong { text-transform: uppercase; color: #8ed6ad; font-size: 12px; }
    article span, article small { color: #9d9586; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 6px; }
    th, td { text-align: left; border-bottom: 1px solid #343735; padding: 10px; vertical-align: top; font-size: 13px; }
    th { color: #9d9586; text-transform: uppercase; font-size: 11px; }
    .gate { border-color: #8b6f2f; background: #1f1b13; }
    .ok { color: #8ed6ad; }
  </style>
</head>
<body>
<main>
  <header>
    <h1>CCW Publish Execution Lane Sandbox Demo</h1>
    <p>This is a dry-run view of the real approved CCW package, real calendar slots, real publish queue rows, and real safety-gate checks. It does not dispatch to Facebook, Instagram, LinkedIn, or Reddit.</p>
    <p>Generated ${escapeHtml(demo.generatedAt)} from ${escapeHtml(demo.mode)}.</p>
  </header>

  <div class="metrics">
    <div class="metric"><span>Calendar weeks</span><strong>${demo.summary.calendarWeeks}</strong></div>
    <div class="metric"><span>Approved slots</span><strong>${demo.summary.approvedSlots}</strong></div>
    <div class="metric"><span>Queued items</span><strong>${demo.summary.queuedItems}</strong></div>
    <div class="metric"><span>Manual/not queued</span><strong>${demo.summary.manualOrNotQueuedSlots}</strong></div>
  </div>

  <section class="gate">
    <h2>Dry-Run Publish Gates</h2>
    <p>${escapeHtml(demo.feedbackLoop.nextBatchRule)}</p>
    <table>
      <thead><tr><th>Scheduled</th><th>Platform</th><th>Queue</th><th>Gate</th><th>Reason</th></tr></thead>
      <tbody>${queueRows}</tbody>
    </table>
  </section>

  ${weekCards}
</main>
</body>
</html>`;
}

async function main() {
  await mkdir(SCRATCHPAD_DIR, { recursive: true });
  const demo = await buildDemo();
  await Promise.all([
    writeFile(JSON_PATH, `${JSON.stringify(demo, null, 2)}\n`),
    writeFile(MARKDOWN_PATH, renderMarkdown(demo)),
    writeFile(HTML_PATH, renderHtml(demo)),
  ]);

  console.log(
    JSON.stringify(
      {
        success: true,
        mode: demo.mode,
        summary: demo.summary,
        artifacts: {
          json: JSON_PATH,
          markdown: MARKDOWN_PATH,
          html: HTML_PATH,
        },
      },
      null,
      2
    )
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
