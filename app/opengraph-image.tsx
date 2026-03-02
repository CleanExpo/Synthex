import { ImageResponse } from 'next/og';

export const alt = 'Synthex - AI-Powered Marketing Agency';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, #0a1628 0%, #0d1f35 50%, #0a1628 100%)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Border accent */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #06b6d4, #22d3ee, #06b6d4)',
          }}
        />

        {/* Logo text */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #06b6d4, #22d3ee)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px',
              fontSize: '28px',
              fontWeight: 700,
              color: '#0a1628',
            }}
          >
            S
          </div>
          <span
            style={{
              fontSize: '48px',
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-1px',
            }}
          >
            Synthex
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 600,
            background: 'linear-gradient(90deg, #22d3ee, #06b6d4)',
            backgroundClip: 'text',
            color: 'transparent',
            marginBottom: '16px',
          }}
        >
          AI-Powered Marketing Agency
        </div>

        {/* Description */}
        <div
          style={{
            fontSize: '18px',
            color: '#94a3b8',
            maxWidth: '600px',
            textAlign: 'center',
            lineHeight: 1.5,
          }}
        >
          Generate viral content, automate scheduling, and optimize engagement across 9+ platforms
        </div>

        {/* Bottom accent */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            color: '#64748b',
          }}
        >
          synthex.social
        </div>
      </div>
    ),
    { ...size }
  );
}
