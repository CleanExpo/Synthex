/**
 * Git Commit Timeline Composition — lib/remotion/compositions/GitCommitTimeline.tsx
 *
 * BTS series: visualises a sequence of git commits / milestones as a scrolling
 * vertical timeline. Used in "Behind the Scenes" episodes that cover Synthex
 * product evolution, sprint completions, and architectural decisions.
 *
 * Format: 16:9 landscape (1920×1080), 900 frames / 30 seconds at 30fps.
 * Each commit animates in with a staggered slide-in-from-left effect.
 *
 * @task SYN-572 (Sprint 5 — BTS Remotion compositions)
 */

import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { GitCommitTimelineProps, GitCommit } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = '#f59e0b'; // Synthex amber
const BG = '#0A0F1A'; // Deep navy — slightly darker than other compositions
const SURFACE = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)';
const LINE_COLOUR = 'rgba(245,158,11,0.25)';
const COMMIT_INTERVAL = 60; // frames between commits appearing (~2s per commit)

// ── Single commit row ─────────────────────────────────────────────────────────

function CommitRow({
  commit,
  index,
  frame,
  brandColour,
}: {
  commit: GitCommit;
  index: number;
  frame: number;
  brandColour: string;
}) {
  const startFrame = 20 + index * COMMIT_INTERVAL;

  const slideX = interpolate(frame, [startFrame, startFrame + 30], [-120, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const opacity = interpolate(frame, [startFrame, startFrame + 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const typeColours: Record<string, string> = {
    feat: '#10b981',
    fix: '#ef4444',
    refactor: '#8b5cf6',
    docs: '#3b82f6',
    test: '#f59e0b',
    chore: '#6b7280',
  };

  const typeColour = typeColours[commit.type ?? 'feat'] ?? brandColour;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 24,
        opacity,
        transform: `translateX(${slideX}px)`,
        marginBottom: 28,
      }}
    >
      {/* Timeline dot */}
      <div
        style={{
          flexShrink: 0,
          width: 14,
          height: 14,
          borderRadius: '50%',
          backgroundColor: brandColour,
          marginTop: 6,
          boxShadow: `0 0 12px ${brandColour}60`,
        }}
      />

      {/* Commit card */}
      <div
        style={{
          flex: 1,
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER}`,
          borderLeft: `3px solid ${typeColour}`,
          borderRadius: 8,
          padding: '14px 20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 6,
          }}
        >
          {/* Commit type badge */}
          <span
            style={{
              backgroundColor: `${typeColour}22`,
              color: typeColour,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1,
              padding: '3px 10px',
              borderRadius: 4,
              textTransform: 'uppercase',
            }}
          >
            {commit.type ?? 'feat'}
          </span>

          {/* Hash */}
          <span
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: 16,
              fontFamily: 'monospace',
            }}
          >
            {commit.hash}
          </span>

          {/* Date */}
          {commit.date && (
            <span
              style={{
                color: TEXT_SECONDARY,
                fontSize: 16,
                marginLeft: 'auto',
              }}
            >
              {commit.date}
            </span>
          )}
        </div>

        {/* Message */}
        <p
          style={{
            color: TEXT_PRIMARY,
            fontSize: 22,
            fontWeight: 500,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {commit.message}
        </p>

        {/* Scope tag */}
        {commit.scope && (
          <p
            style={{
              color: TEXT_SECONDARY,
              fontSize: 17,
              margin: '6px 0 0',
            }}
          >
            scope: {commit.scope}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main composition ──────────────────────────────────────────────────────────

export function GitCommitTimeline({
  title,
  commits,
  episodeContext,
  brandColour = ACCENT,
}: GitCommitTimelineProps) {
  const frame = useCurrentFrame();
  const totalFrames = 900;

  // Header fade-in
  const headerOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Subtitle fade-in
  const subtitleOpacity = interpolate(frame, [15, 40], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Global fade-out in last 25 frames
  const fadeOut = interpolate(frame, [totalFrames - 25, totalFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG,
        fontFamily:
          "'Inter', 'Helvetica Neue', system-ui, -apple-system, sans-serif",
        opacity: fadeOut,
      }}
    >
      {/* Left timeline rail */}
      <div
        style={{
          position: 'absolute',
          left: 130,
          top: 160,
          bottom: 80,
          width: 2,
          backgroundColor: LINE_COLOUR,
        }}
      />

      {/* Header section */}
      <div
        style={{
          paddingLeft: 80,
          paddingTop: 56,
          paddingBottom: 36,
          borderBottom: `1px solid ${BORDER}`,
          opacity: headerOpacity,
          position: 'relative',
          zIndex: 1,
          backgroundColor: BG,
        }}
      >
        {/* BTS badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: `${brandColour}18`,
            border: `1px solid ${brandColour}40`,
            borderRadius: 6,
            padding: '5px 14px',
            marginBottom: 16,
          }}
        >
          <span
            style={{
              color: brandColour,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Behind the Scenes
          </span>
        </div>

        <h1
          style={{
            color: TEXT_PRIMARY,
            fontSize: 48,
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h1>

        {episodeContext && (
          <p
            style={{
              color: TEXT_SECONDARY,
              fontSize: 24,
              margin: '10px 0 0',
              opacity: subtitleOpacity,
            }}
          >
            {episodeContext}
          </p>
        )}
      </div>

      {/* Commit list */}
      <div
        style={{
          paddingLeft: 108, // aligns with dot centre (130 - 14/2 - gap)
          paddingRight: 80,
          paddingTop: 32,
          overflow: 'hidden',
        }}
      >
        {commits.slice(0, 7).map((commit, i) => (
          <CommitRow
            key={commit.hash}
            commit={commit}
            index={i}
            frame={frame}
            brandColour={brandColour}
          />
        ))}
      </div>

      {/* Bottom brand strip */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 5,
          backgroundColor: brandColour,
        }}
      />

      {/* Watermark */}
      <div
        style={{
          position: 'absolute',
          bottom: 22,
          right: 60,
          color: `${brandColour}90`,
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 1,
        }}
      >
        synthex.social
      </div>
    </AbsoluteFill>
  );
}
