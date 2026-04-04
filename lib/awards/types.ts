/**
 * Award & Directory Orchestrator — Type Definitions (Phase 94)
 *
 * @module lib/awards/types
 */

// ---------------------------------------------------------------------------
// Award Types
// ---------------------------------------------------------------------------

export type AwardStatus =
  | 'researched'
  | 'in-progress'
  | 'submitted'
  | 'won'
  | 'shortlisted'
  | 'not-selected';

export type AwardPriority = 'low' | 'medium' | 'high';

export interface AwardInput {
  name: string;
  organizer: string;
  category: string;
  deadline?: string;       // ISO date string
  submissionUrl?: string;
  status?: AwardStatus;
  description?: string;
  nominationDraft?: string;
  entryFee?: string;
  isRecurring?: boolean;
  recurrenceNote?: string;
  priority?: AwardPriority;
  notes?: string;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Directory Types
// ---------------------------------------------------------------------------

export type DirectoryStatus =
  | 'identified'
  | 'submitted'
  | 'live'
  | 'needs-update'
  | 'rejected';

export interface DirectoryInput {
  directoryName: string;
  directoryUrl: string;
  listingUrl?: string;
  category?: string;
  status?: DirectoryStatus;
  domainAuthority?: number;
  isFree?: boolean;
  submittedAt?: string;    // ISO date string
  lastReviewedAt?: string; // ISO date string
  notes?: string;
  isAiIndexed?: boolean;
  orgId: string;
}

// ---------------------------------------------------------------------------
// Nomination Draft (AI output)
// ---------------------------------------------------------------------------

export interface NominationDraft {
  /** Short title for the nomination entry */
  title: string;
  /** Full nomination body text */
  body: string;
  /** Key bullet points extracted from the nomination */
  keyPoints: string[];
  /** Word count of the body */
  wordCount: number;
  /** Whether the nomination was AI-generated or template-based */
  isAiGenerated: boolean;
}

// ---------------------------------------------------------------------------
// Submission Tracker Types
// ---------------------------------------------------------------------------

export type TrackerStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';
export type TrackerType = 'award' | 'directory';

// ---------------------------------------------------------------------------
// Submission Summary (dashboard aggregate)
// ---------------------------------------------------------------------------

export interface SubmissionSummary {
  /** Total awards being tracked */
  totalAwards: number;
  /** Awards submitted */
  awardSubmitted: number;
  /** Awards won or shortlisted */
  awardSuccess: number;
  /** Total directories being tracked */
  totalDirectories: number;
  /** Directories with status 'live' */
  directoriesLive: number;
  /** Upcoming deadlines within 90 days (award deadlines only) */
  upcomingDeadlines: UpcomingDeadline[];
}

export interface UpcomingDeadline {
  id: string;
  name: string;
  type: 'award';
  deadline: string; // ISO date string
  daysUntil: number;
  priority: AwardPriority;
  status: AwardStatus;
}
