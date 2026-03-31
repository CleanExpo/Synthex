/**
 * Board Decision Card Composition — lib/remotion/compositions/BoardDecisionCard.tsx
 *
 * BTS series: presents a board/phase decision memo in a styled card format.
 * Used in "Behind the Scenes" episodes covering Synthex strategy sessions,
 * phase planning decisions, and product direction choices.
 *
 * Format: 16:9 landscape (1920×1080), 750 frames / 25 seconds at 30fps.
 * Animates: badge → date → title → decision text → outcome → action items.
 *
 * @task SYN-572 (Sprint 5 — BTS Remotion compositions)
 */

import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from 'remotion';
import type { BoardDecisionCardProps } from '../types';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT = '#f59e0b';
const BG = '#0A0F1A';
const SURFACE = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#FFFFFF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.55)';

// ── Animation helpers ─────────────────────────────────────────────────────────

function fadeIn(frame: number, start: number, duration: number = 25): number {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

function slideUp(
  frame: number,
  start: number,
  duration: number = 30,
  distance: number = 40
): number {
  return interpolate(frame, [start, start + duration], [distance, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
}

// ── Main composition ──────────────────────────────────────────────────────────

export function BoardDecisionCard({
  title,
  decisionContext,
  decision,
  rationale,
  outcome,
  actionItems,
  phase,
  decisionDate,
  brandColour = ACCENT,
}: BoardDecisionCardProps) {
  const frame = useCurrentFrame();
  const totalFrames = 750;

  // Staggered animation timings
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
        padding: '56px 80px',
        opacity: fadeOut,
      }}
    >
      {/* Top bar — phase + date */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 36,
          opacity: fadeIn(frame, 0),
          transform: `translateY(${slideUp(frame, 0)}px)`,
        }}
      >
        {/* Phase badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            backgroundColor: `${brandColour}18`,
            border: `1px solid ${brandColour}40`,
            borderRadius: 8,
            padding: '8px 18px',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: brandColour,
              display: 'inline-block',
            }}
          />
          <span
            style={{
              color: brandColour,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
            }}
          >
            {phase ?? 'Board Decision'} · Behind the Scenes
          </span>
        </div>

        {/* Date */}
        {decisionDate && (
          <span
            style={{
              color: TEXT_SECONDARY,
              fontSize: 20,
            }}
          >
            {decisionDate}
          </span>
        )}
      </div>

      {/* Main card */}
      <div
        style={{
          backgroundColor: SURFACE,
          border: `1px solid ${BORDER}`,
          borderLeft: `4px solid ${brandColour}`,
          borderRadius: 12,
          padding: '40px 48px',
          flex: 1,
          opacity: fadeIn(frame, 10),
          transform: `translateY(${slideUp(frame, 10)}px)`,
        }}
      >
        {/* Context label */}
        {decisionContext && (
          <p
            style={{
              color: TEXT_SECONDARY,
              fontSize: 20,
              margin: '0 0 12px',
              opacity: fadeIn(frame, 15),
            }}
          >
            {decisionContext}
          </p>
        )}

        {/* Decision title */}
        <h1
          style={{
            color: TEXT_PRIMARY,
            fontSize: 52,
            fontWeight: 800,
            margin: '0 0 28px',
            lineHeight: 1.25,
            opacity: fadeIn(frame, 20),
            transform: `translateY(${slideUp(frame, 20)}px)`,
          }}
        >
          {title}
        </h1>

        {/* Divider */}
        <div
          style={{
            width: 64,
            height: 3,
            backgroundColor: brandColour,
            borderRadius: 2,
            marginBottom: 28,
            opacity: fadeIn(frame, 30),
          }}
        />

        {/* Decision body */}
        <p
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontSize: 26,
            lineHeight: 1.6,
            margin: '0 0 24px',
            opacity: fadeIn(frame, 40),
            transform: `translateY(${slideUp(frame, 40, 25, 20)}px)`,
          }}
        >
          {decision}
        </p>

        {/* Rationale */}
        {rationale && (
          <div
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              padding: '16px 20px',
              marginBottom: 24,
              opacity: fadeIn(frame, 60),
              transform: `translateY(${slideUp(frame, 60, 25, 20)}px)`,
            }}
          >
            <p
              style={{
                color: TEXT_SECONDARY,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                margin: '0 0 8px',
              }}
            >
              Rationale
            </p>
            <p
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: 22,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {rationale}
            </p>
          </div>
        )}

        {/* Outcome */}
        {outcome && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              marginBottom: actionItems && actionItems.length > 0 ? 24 : 0,
              opacity: fadeIn(frame, 80),
              transform: `translateY(${slideUp(frame, 80, 25, 20)}px)`,
            }}
          >
            <div
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                borderRadius: '50%',
                backgroundColor: '#10b98120',
                border: '1px solid #10b98140',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                marginTop: 2,
              }}
            >
              ✓
            </div>
            <div>
              <p
                style={{
                  color: '#10b981',
                  fontSize: 16,
                  fontWeight: 700,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                  margin: '0 0 6px',
                }}
              >
                Outcome
              </p>
              <p
                style={{
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: 22,
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {outcome}
              </p>
            </div>
          </div>
        )}

        {/* Action items */}
        {actionItems && actionItems.length > 0 && (
          <div
            style={{
              opacity: fadeIn(frame, 100),
              transform: `translateY(${slideUp(frame, 100, 25, 20)}px)`,
            }}
          >
            <p
              style={{
                color: TEXT_SECONDARY,
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
                margin: '0 0 12px',
              }}
            >
              Action Items
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {actionItems.slice(0, 3).map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    opacity: fadeIn(frame, 110 + i * 12),
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: brandColour,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.75)',
                      fontSize: 20,
                      lineHeight: 1.4,
                    }}
                  >
                    {item}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom accent bar */}
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
          right: 80,
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
