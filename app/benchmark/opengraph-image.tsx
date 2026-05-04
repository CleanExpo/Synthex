/**
 * /benchmark — Open Graph image (SYN-804).
 *
 * Generated dynamically by Next.js at build time. Matches the page's
 * dark glassmorphic aesthetic (orange-on-deep-blue) and surfaces the
 * "measured in real results" framing so social card unfurls (LinkedIn,
 * X, Facebook, Slack) preview the actual proposition rather than
 * falling back to the default site OG image.
 */

import { ImageResponse } from 'next/og';

export const alt = 'Synthex Benchmark — measured in real results';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        padding: '80px',
        background:
          'linear-gradient(135deg, #050505 0%, #0d1f35 50%, #050505 100%)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Top accent stripe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: 'linear-gradient(90deg, #ffb87b, #ffdcc2, #ffb87b)',
        }}
      />

      {/* Brand mark */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: '40px',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ffb87b, #ffdcc2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '16px',
            fontSize: '24px',
            fontWeight: 700,
            color: '#050505',
          }}
        >
          S
        </div>
        <span
          style={{
            fontSize: '32px',
            fontWeight: 600,
            color: '#ffffff',
            letterSpacing: '-0.5px',
          }}
        >
          Synthex
        </span>
        <span
          style={{
            fontSize: '20px',
            color: '#94a3b8',
            marginLeft: '16px',
            paddingLeft: '16px',
            borderLeft: '1px solid #475569',
          }}
        >
          Benchmark
        </span>
      </div>

      {/* Headline */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          fontSize: '72px',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-2px',
          lineHeight: 1.05,
          marginBottom: '24px',
          maxWidth: '950px',
        }}
      >
        <span>Measured in</span>
        <span
          style={{
            background: 'linear-gradient(90deg, #ffdcc2, #ffb87b)',
            backgroundClip: 'text',
            color: 'transparent',
            marginLeft: '20px',
          }}
        >
          real results.
        </span>
      </div>

      {/* Subheadline */}
      <div
        style={{
          fontSize: '24px',
          color: '#94a3b8',
          maxWidth: '900px',
          lineHeight: 1.4,
          marginBottom: '40px',
        }}
      >
        Every claim is grounded in anonymised aggregate data and disclosed with
        its sample size.
      </div>

      {/* Bottom row — proof points */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '32px',
          color: '#cbd5e1',
          fontSize: '18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '999px',
              background: '#ffb87b',
              marginRight: '12px',
            }}
          />
          Live cohort
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '999px',
              background: '#ffb87b',
              marginRight: '12px',
            }}
          />
          Sample-size disclosed
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '999px',
              background: '#ffb87b',
              marginRight: '12px',
            }}
          />
          Updated every 10 min
        </div>
      </div>

      {/* Footer URL */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          right: '80px',
          fontSize: '16px',
          color: '#64748b',
        }}
      >
        synthex.social/benchmark
      </div>
    </div>,
    { ...size }
  );
}
