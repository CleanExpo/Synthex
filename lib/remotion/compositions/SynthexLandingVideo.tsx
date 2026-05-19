'use client';

import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const orange = '#f97316';
const amber = '#fbbf24';
const bg = '#08090b';
const panel = '#111318';
const line = 'rgba(255,255,255,0.14)';

const scenes = [
  {
    title: 'A real agency process, visible in seconds.',
    copy: 'Research, strategy, creative and approval gates move through one command center.',
  },
  {
    title: 'Ground every campaign before production starts.',
    copy: 'Search, social, product data, wiki sources and client notes become an evidence trail.',
  },
  {
    title: 'Approve the board, then generate the media.',
    copy: 'Storyboards, thumbnails, posts, emails and video briefs stay controlled until the human gate is clear.',
  },
  {
    title: 'Synthex learns from the outcome.',
    copy: 'Views, clicks, leads and rankings feed the next campaign instead of vanishing in reports.',
  },
];

export function SynthexLandingVideo() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneIndex = Math.min(scenes.length - 1, Math.floor(frame / 90));
  const localFrame = frame - sceneIndex * 90;
  const active = scenes[sceneIndex];
  const reveal = spring({
    frame: localFrame,
    fps,
    config: { damping: 18, stiffness: 90 },
  });
  const progress = interpolate(frame, [0, 360], [0, 100], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: bg,
        color: 'white',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      <GridBackdrop />
      <div
        style={{
          position: 'absolute',
          inset: 54,
          display: 'grid',
          gridTemplateColumns: '0.88fr 1.12fr',
          gap: 34,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            border: `1px solid ${line}`,
            background: 'rgba(255,255,255,0.035)',
            padding: 34,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                border: '1px solid rgba(249,115,22,0.35)',
                color: '#fed7aa',
                background: 'rgba(249,115,22,0.1)',
                padding: '10px 14px',
                fontSize: 14,
                letterSpacing: 3.5,
                textTransform: 'uppercase',
              }}
            >
              Synthex
            </div>
            <h1
              style={{
                margin: '34px 0 0',
                maxWidth: 650,
                fontSize: 62,
                lineHeight: 0.98,
                letterSpacing: -2,
                fontWeight: 760,
              }}
            >
              Marketing command center for work that has to convert.
            </h1>
          </div>
          <div>
            <p
              style={{
                margin: 0,
                maxWidth: 580,
                color: 'rgba(255,255,255,0.62)',
                fontSize: 24,
                lineHeight: 1.42,
              }}
            >
              From signal to storyboard to approved production packet.
            </p>
            <div
              style={{
                marginTop: 28,
                height: 6,
                background: 'rgba(255,255,255,0.08)',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: `linear-gradient(90deg, ${orange}, ${amber})`,
                }}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            border: `1px solid ${line}`,
            background: panel,
            padding: 28,
            overflow: 'hidden',
          }}
        >
          <SignalRail frame={frame} />
          <div
            style={{
              position: 'relative',
              zIndex: 2,
              height: '100%',
              display: 'grid',
              gridTemplateRows: 'auto 1fr auto',
              gap: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {['Research', 'Strategy', 'Studio', 'Approval'].map((label, i) => (
                <div
                  key={label}
                  style={{
                    minWidth: 132,
                    border: `1px solid ${
                      i <= sceneIndex ? 'rgba(249,115,22,0.45)' : line
                    }`,
                    color:
                      i <= sceneIndex
                        ? '#fed7aa'
                        : 'rgba(255,255,255,0.42)',
                    padding: '12px 14px',
                    fontSize: 16,
                    textTransform: 'uppercase',
                    letterSpacing: 2,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>

            <div
              style={{
                alignSelf: 'center',
                transform: `translateY(${interpolate(reveal, [0, 1], [24, 0])}px)`,
                opacity: interpolate(reveal, [0, 1], [0, 1]),
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 54,
                  lineHeight: 1.04,
                  letterSpacing: -1.4,
                  fontWeight: 720,
                  maxWidth: 760,
                }}
              >
                {active.title}
              </h2>
              <p
                style={{
                  margin: '22px 0 0',
                  maxWidth: 720,
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: 25,
                  lineHeight: 1.42,
                }}
              >
                {active.copy}
              </p>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 14,
              }}
            >
              <Metric label="Evidence refs" value={`${14 + sceneIndex * 3}`} />
              <Metric label="Approval gate" value="On" />
              <Metric label="Public spend" value="Blocked" />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
}

function GridBackdrop() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
      }}
    />
  );
}

function SignalRail({ frame }: { frame: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, opacity: 0.42 }}>
      {Array.from({ length: 9 }).map((_, i) => {
        const width = interpolate(
          (frame + i * 16) % 90,
          [0, 45, 90],
          [12, 86, 20]
        );
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              right: 34,
              top: 86 + i * 54,
              width: `${width}%`,
              height: 2,
              background:
                i % 3 === 0
                  ? 'rgba(249,115,22,0.7)'
                  : 'rgba(255,255,255,0.14)',
            }}
          />
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${line}`,
        background: 'rgba(0,0,0,0.22)',
        padding: 18,
      }}
    >
      <div
        style={{
          color: 'rgba(255,255,255,0.42)',
          fontSize: 13,
          letterSpacing: 2.4,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 10,
          color: value === 'Blocked' ? '#fca5a5' : '#fff7ed',
          fontSize: 34,
          fontWeight: 720,
        }}
      >
        {value}
      </div>
    </div>
  );
}
