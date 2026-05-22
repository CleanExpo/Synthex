/**
 * Command Centre — TypeScript Interfaces
 *
 * @module components/command-centre/types
 */

import type {
  BoardInput,
  CommandPacket,
} from '@/lib/unite-command-center';

// ============================================================================
// AUTOPILOT STATUS
// ============================================================================

export interface AutopilotStatus {
  autopilot: {
    enabled: boolean;
    status: 'idle' | 'generating' | 'scheduling' | 'paused' | 'error';
    nextRunAt: string | null;
    lastRunAt: string | null;
    enabledPlatforms: string[];
    lastErrorMessage?: string | null;
    postsPerDayPerPlatform?: number;
    autoApproveThreshold?: number;
    minScoreThreshold?: number;
  };
  lastRun: {
    id: string;
    runType: string;
    status: string;
    postsGenerated: number;
    postsScheduled: number;
    avgScore: number | null;
    startedAt: string;
    completedAt: string | null;
  } | null;
  activePersona: {
    id: string;
    name: string;
    tone: string;
  } | null;
  connectedPlatforms: number;
  pipelineHealth: 'green' | 'yellow' | 'red';
  closeLoopHealth: {
    overall: 'green' | 'yellow' | 'red';
    checkedAt: string;
    pipelines: Array<{
      name: string;
      lastRunAt: string | null;
      status: 'success' | 'partial' | 'failed' | 'no_data';
      clientsProcessed: number;
      clientsFailed: number;
      durationMs: number | null;
      stale: boolean;
    }>;
    learningSignals: Array<{
      name: 'marketing-agency-outcomes';
      lastObservedAt: string | null;
      status: 'active' | 'stale' | 'no_data';
      eventsObserved: number;
      latestEventType: string | null;
      stale: boolean;
    }>;
  } | null;
}

// ============================================================================
// ACTIVITY FEED
// ============================================================================

export interface AIActivityItem {
  id: string;
  type: 'autopilot_run';
  action: string;
  description: string;
  status: string;
  metadata: {
    runType: string;
    postsGenerated: number;
    postsScheduled: number;
    postsDrafted: number;
    avgScore: number | null;
  };
  timestamp: string;
  completedAt: string | null;
  durationMs: number | null;
}

// ============================================================================
// PENDING CONTENT
// ============================================================================

export interface PendingContent {
  id: string;
  content: string;
  platform: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  campaignName: string;
  score: number | null;
  theme: string | null;
  qualityDecision: string | null;
}

// ============================================================================
// PERFORMANCE
// ============================================================================

export interface PerformanceMetrics {
  posts: number;
  avgEngagement: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
}

export interface DailyBreakdown {
  date: string;
  posts: number;
  avgEngagement: number;
}

export interface PerformanceData {
  sevenDay: PerformanceMetrics;
  thirtyDay: PerformanceMetrics;
  dailyBreakdown: DailyBreakdown[];
  totalAutopilotPosts: number;
}

// ============================================================================
// STATS
// ============================================================================

export interface CommandCentreStats {
  totalPostsGenerated: number;
  postsScheduled: number;
  postsPendingReview: number;
  postsPublished30d: number;
  avgQualityScore: number;
  connectedPlatforms: number;
}

// ============================================================================
// DRAFT COMMAND INTAKE
// ============================================================================

export interface DraftCommandResponse {
  mode: 'draft';
  persisted: false;
  executionBlocked: true;
  boardInput: BoardInput;
  commandPacket: CommandPacket;
}
