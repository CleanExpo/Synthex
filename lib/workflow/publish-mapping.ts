/**
 * Map approved workflow content into a ContentCalendar slot (SYN-1040 slice 1).
 *
 * The agency-loop publish step produces free-form approved content; the real
 * publish pipeline (PublishQueueItem) is keyed on ContentCalendar slots. This
 * pure mapper bridges the two so a later slice can persist + enqueue. No DB
 * access here — it only shapes data, which keeps it fully unit-testable.
 */
import type {
  CalendarSlot,
  CalendarPlatform,
  ContentType,
} from '@/lib/calendar/types';

const CALENDAR_PLATFORMS: readonly CalendarPlatform[] = [
  'instagram',
  'facebook',
  'linkedin',
  'twitter',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
];

/** Pull the caption text out of a workflow step's free-form output. */
export function extractCaption(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content && typeof content === 'object') {
    const o = content as Record<string, unknown>;
    if (typeof o.content === 'string') return o.content;
    if (typeof o.caption === 'string') return o.caption;
    if (Array.isArray(o.captions) && typeof o.captions[0] === 'string') {
      return o.captions[0];
    }
  }
  return '';
}

/** Hashtags present in the caption, de-duplicated, order-preserving. */
export function extractHashtags(caption: string): string[] {
  return Array.from(new Set(caption.match(/#[A-Za-z0-9_]+/g) ?? []));
}

export interface WorkflowContentToSlotInput {
  /** Stable slot id (cuid) the caller supplies. */
  id: string;
  /** The approved content output from the workflow's generate step. */
  content: unknown;
  /** Target platform (must be a calendar-supported platform). */
  platform: string;
  /** When to schedule the post. */
  scheduledAt: Date;
  /** Content category; defaults to 'educational'. */
  contentType?: ContentType;
}

/**
 * Shape approved workflow content into a CalendarSlot. Throws on an unsupported
 * platform rather than silently mis-routing a publish.
 */
export function workflowContentToCalendarSlot(
  input: WorkflowContentToSlotInput,
): CalendarSlot {
  const platform = input.platform.toLowerCase();
  if (!CALENDAR_PLATFORMS.includes(platform as CalendarPlatform)) {
    throw new Error(
      `workflowContentToCalendarSlot: unsupported platform "${input.platform}"`,
    );
  }

  const caption = extractCaption(input.content);
  // CalendarSlot dayOfWeek convention is 0 = Monday … 6 = Sunday.
  const dayOfWeek = (input.scheduledAt.getUTCDay() + 6) % 7;

  return {
    id: input.id,
    dayOfWeek,
    scheduledAt: input.scheduledAt.toISOString(),
    platform: platform as CalendarPlatform,
    captions: caption ? [caption] : [],
    hashtags: extractHashtags(caption),
    contentType: input.contentType ?? 'educational',
  };
}
