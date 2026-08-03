'use client';

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export type MarketingExtenderVideoMode =
  | 'intro'
  | 'context'
  | 'expand'
  | 'decision'
  | 'handoff';

export interface MarketingExtenderVideoProps {
  mode: MarketingExtenderVideoMode;
}

const COLOURS = {
  background: '#050608',
  panel: '#12151b',
  elevated: '#181c23',
  text: '#f5f7fa',
  muted: '#7d8694',
  orange: '#ff7a18',
  violet: '#8b5cf6',
  cyan: '#38bdf8',
  green: '#34d399',
};

const CONTENT: Record<
  MarketingExtenderVideoMode,
  {
    kicker: string;
    title: string;
    scenes: Array<{ label: string; copy: string }>;
  }
> = {
  intro: {
    kicker: 'Synthex / Marketing Extender',
    title: 'A rough idea becomes a bigger, safer vision.',
    scenes: [
      {
        label: '01 · Signal',
        copy: 'Describe the situation in your own words.',
      },
      {
        label: '02 · Expand',
        copy: 'Agents explore seven lenses and competing causes.',
      },
      {
        label: '03 · Decide',
        copy: 'You choose the direction, success test and boundaries.',
      },
      {
        label: '04 · Keep it',
        copy: 'Download the complete vision brief as Markdown.',
      },
      {
        label: '05 · Handoff',
        copy: 'Optionally send the whole brief into Unite-Group Nexus.',
      },
    ],
  },
  context: {
    kicker: 'Stage 01 / Context',
    title: 'Your first sentence is a signal—not the final answer.',
    scenes: [
      {
        label: 'One paste',
        copy: 'Add a website, social links, documents and notes together.',
      },
      {
        label: 'Auto-sort',
        copy: 'Synthex classifies the evidence without an interview.',
      },
      {
        label: 'Preserve',
        copy: 'The original wording remains traceable in the Context Field.',
      },
    ],
  },
  expand: {
    kicker: 'Stage 02 / Expansion',
    title: 'The agents look beyond the requested deliverable.',
    scenes: [
      { label: 'Causes', copy: 'What could be creating the visible problem?' },
      {
        label: 'Stakeholders',
        copy: 'Who uses, decides, gains, loses or blocks?',
      },
      {
        label: 'Alternatives',
        copy: 'What still matters if the requested solution is impossible?',
      },
    ],
  },
  decision: {
    kicker: 'Stage 03 / Human decision',
    title: 'Synthex explores. You authorise.',
    scenes: [
      { label: 'Select', copy: 'Choose one exact hypothesis version.' },
      { label: 'Measure', copy: 'Define an observable acceptance criterion.' },
      {
        label: 'Bound',
        copy: 'Keep publishing, spend and irreversible actions locked.',
      },
    ],
  },
  handoff: {
    kicker: 'Stage 04 / Result and handoff',
    title: 'Leave with value before entering a sales funnel.',
    scenes: [
      {
        label: 'Download',
        copy: 'Keep the governed Markdown vision brief for free.',
      },
      {
        label: 'Consent',
        copy: 'Nothing enters Nexus without an explicit choice.',
      },
      {
        label: 'Continue',
        copy: 'A strategist receives the idea with all context intact.',
      },
    ],
  },
};

export function MarketingExtenderVideo({ mode }: MarketingExtenderVideoProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const content = CONTENT[mode];
  const sceneFrames = Math.floor(durationInFrames / content.scenes.length);
  const sceneIndex = Math.min(
    content.scenes.length - 1,
    Math.floor(frame / sceneFrames)
  );
  const localFrame = frame - sceneIndex * sceneFrames;
  const reveal = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 95 },
  });
  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: COLOURS.background,
        color: COLOURS.text,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '54px 54px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          left: 520,
          top: -300,
          borderRadius: '50%',
          background: 'rgba(139,92,246,0.18)',
          filter: 'blur(100px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 44,
          display: 'grid',
          gridTemplateColumns: '0.9fr 1.1fr',
          gap: 28,
        }}
      >
        <section
          style={{
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 18,
            background: 'rgba(18,21,27,0.94)',
            padding: 34,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                color: COLOURS.orange,
                fontSize: 14,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              {content.kicker}
            </div>
            <h1
              style={{
                margin: '30px 0 0',
                fontSize: mode === 'intro' ? 54 : 48,
                lineHeight: 1.03,
                letterSpacing: -2,
                fontWeight: 680,
              }}
            >
              {content.title}
            </h1>
          </div>
          <div>
            <div style={{ color: COLOURS.muted, fontSize: 17 }}>
              Observe → Think → Research → Decide → Act
            </div>
            <div
              style={{
                marginTop: 18,
                height: 5,
                overflow: 'hidden',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.08)',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${COLOURS.orange}, ${COLOURS.violet})`,
                }}
              />
            </div>
          </div>
        </section>

        <section
          style={{
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 18,
            background: COLOURS.elevated,
            padding: 30,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            {content.scenes.map((scene, index) => (
              <div
                key={scene.label}
                style={{
                  height: 6,
                  flex: 1,
                  borderRadius: 8,
                  background:
                    index <= sceneIndex
                      ? index === sceneIndex
                        ? COLOURS.orange
                        : COLOURS.violet
                      : 'rgba(255,255,255,0.09)',
                }}
              />
            ))}
          </div>

          <div
            style={{
              height: 'calc(100% - 20px)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              opacity: interpolate(reveal, [0, 1], [0, 1]),
              transform: `translateY(${interpolate(reveal, [0, 1], [28, 0])}px)`,
            }}
          >
            <div
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(139,92,246,0.35)',
                background: 'rgba(139,92,246,0.09)',
                color: '#c4b5fd',
                fontSize: 14,
                letterSpacing: 2.4,
                textTransform: 'uppercase',
              }}
            >
              {content.scenes[sceneIndex]?.label}
            </div>
            <h2
              style={{
                margin: '28px 0 0',
                maxWidth: 600,
                fontSize: 50,
                lineHeight: 1.08,
                letterSpacing: -1.6,
                fontWeight: 650,
              }}
            >
              {content.scenes[sceneIndex]?.copy}
            </h2>
            <div
              style={{
                marginTop: 38,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 12,
              }}
            >
              {[
                ['Evidence', COLOURS.cyan],
                ['Intelligence', COLOURS.violet],
                ['Human gate', COLOURS.green],
              ].map(([label, colour]) => (
                <div
                  key={label}
                  style={{
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 12,
                    background: 'rgba(5,6,8,0.42)',
                    padding: 15,
                    color: colour,
                    fontSize: 15,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AbsoluteFill>
  );
}
