/**
 * Calendar Types — lib/calendar/types.ts
 *
 * Shared TypeScript interfaces for the weekly content calendar engine (SYN-521).
 * Extended with content intelligence tracking fields (SYN-632).
 *
 * @task SYN-521
 */

// ── Slot-level types ──────────────────────────────────────────────────────────

/** The set of platforms a calendar slot can target */
export type CalendarPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'youtube'
  | 'pinterest'
  | 'reddit'
  | 'threads';

/** Content category guiding the AI caption generation */
export type ContentType =
  | 'educational'
  | 'promotional'
  | 'engagement'
  | 'behind-the-scenes'
  | 'testimonial'
  | 'trending';

/** Distinguishes regular AI slots from seasonal market opportunity slots */
export type SlotType = 'ai_generated' | 'market_opportunity';

/**
 * Records which content intelligence signals were applied when generating
 * a slot's captions — enables "informed vs. baseline" engagement comparison.
 * SYN-632
 */
export interface SlotGenerationContext {
  /** Whether content intelligence was applied to this slot */
  intelligenceApplied: boolean;
  /** Top-3 topics from the profile that were included in the prompt */
  topicsUsed: string[];
  /** Whether the slot's scheduled time was influenced by the optimal-times data */
  timeOptimised: boolean;
  /** Hashtags sourced from the intelligence profile (vs digest signals) */
  hashtagsFromProfile: string[];
  /** Profile confidence level at time of generation (0.0–1.0) */
  confidenceLevel: number;
  /** Which data source dominated: industry baseline, client data, or blended */
  dataSource: 'industry_baseline' | 'client_data' | 'blended';
}

/** A single scheduled content slot within a weekly calendar */
export interface CalendarSlot {
  /** Unique slot ID (cuid) */
  id: string;
  /** Day of week: 0 = Monday … 6 = Sunday */
  dayOfWeek: number;
  /** UTC ISO datetime for the optimal posting window */
  scheduledAt: string;
  /** Target platform */
  platform: CalendarPlatform;
  /** 3 AI-generated caption variations the client can choose from */
  captions: string[];
  /** Ranked hashtag set selected for this slot */
  hashtags: string[];
  /** Content category used to prompt the AI */
  contentType: ContentType;
  /**
   * Slot origin — omitted / undefined means 'ai_generated' (backward-compatible
   * with existing JSONB calendar records that pre-date SYN-549).
   */
  slotType?: SlotType;
  /** FK to seasonal_signals.id — only present for market_opportunity slots */
  signalId?: string;
  /** Human-readable opportunity name — e.g. "Winter Pipe Season" */
  opportunityLabel?: string;
  /** Suggested post format for this opportunity */
  suggestedFormat?: 'image' | 'text';
  /**
   * Intelligence signals that informed caption generation — SYN-632.
   * Undefined for slots generated before intelligence integration.
   */
  generationContext?: SlotGenerationContext;
}

// ── Calendar-level types ──────────────────────────────────────────────────────

/** Signals extracted from past weekly digests */
export interface DigestSignals {
  /** Number of completed digests found (minimum 3 required) */
  digestCount: number;
  /** Most frequent content types sorted by performance */
  topContentTypes: ContentType[];
  /** UTC hours (0–23) where engagement peaks, sorted descending */
  peakEngagementHours: number[];
  /** Top hashtags from recent published posts */
  winningHashtags: string[];
  /** Active publishing platforms for this org */
  activePlatforms: CalendarPlatform[];
}

/** Full weekly calendar as stored in the `content_calendars.slots` JSONB column */
export interface ContentCalendarData {
  weekStart: string; // ISO date yyyy-MM-dd
  weekEnd: string; // ISO date yyyy-MM-dd
  slots: CalendarSlot[];
  /**
   * Algorithm version — '1.0' for digest-only calendars,
   * '1.1' when market opportunity slots are included (SYN-549).
   */
  signalsVersion: string;
  /** How many digests informed this calendar */
  digestCount: number;
}

// ── Generation result ─────────────────────────────────────────────────────────

export type CalendarGenerationResult =
  | { success: true; organizationId: string; calendarId: string }
  | { success: false; organizationId: string; reason: string };

/** Thrown when cold-start gate blocks generation */
export class InsufficientDigestsError extends Error {
  constructor(
    public readonly organizationId: string,
    public readonly actual: number,
    public readonly required: number
  ) {
    super(
      `Organisation ${organizationId} has ${actual} digest(s) — need ${required} before calendar generation`
    );
    this.name = 'InsufficientDigestsError';
  }
}
