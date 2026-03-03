import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title') || 'AI-Powered Marketing Agency';
  const description =
    searchParams.get('description') ||
    "The world's first fully autonomous AI marketing agency.";

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a1628 0%, #0f172a 50%, #0a1628 100%)',
          fontFamily: '"Inter", sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Grid pattern overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(6, 182, 212, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.06) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />

        {/* Cyan glow top-left */}
        <div
          style={{
            position: 'absolute',
            top: '-100px',
            left: '-100px',
            width: '500px',
            height: '500px',
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.15) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Cyan glow bottom-right */}
        <div
          style={{
            position: 'absolute',
            bottom: '-100px',
            right: '-100px',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.10) 0%, transparent 70%)',
            borderRadius: '50%',
          }}
        />

        {/* Content container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '24px',
            padding: '60px 80px',
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            maxWidth: '1000px',
          }}
        >
          {/* SYNTHEX logo text */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '8px',
            }}
          >
            {/* Logo mark */}
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: '#ffffff', fontSize: '24px', fontWeight: 800 }}>S</span>
            </div>
            <span
              style={{
                fontSize: '32px',
                fontWeight: 800,
                letterSpacing: '0.12em',
                background: 'linear-gradient(90deg, #06b6d4 0%, #22d3ee 100%)',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              SYNTHEX
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: '80px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)',
              borderRadius: '1px',
            }}
          />

          {/* Page title */}
          <h1
            style={{
              fontSize: title.length > 40 ? '42px' : '54px',
              fontWeight: 700,
              color: '#ffffff',
              lineHeight: 1.2,
              margin: 0,
              maxWidth: '860px',
            }}
          >
            {title}
          </h1>

          {/* Description */}
          <p
            style={{
              fontSize: '22px',
              color: 'rgba(148, 163, 184, 0.9)',
              lineHeight: 1.5,
              margin: 0,
              maxWidth: '760px',
            }}
          >
            {description}
          </p>

          {/* URL badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 20px',
              borderRadius: '999px',
              background: 'rgba(6, 182, 212, 0.10)',
              border: '1px solid rgba(6, 182, 212, 0.25)',
              marginTop: '8px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#06b6d4',
              }}
            />
            <span
              style={{
                fontSize: '16px',
                color: '#06b6d4',
                fontWeight: 500,
                letterSpacing: '0.04em',
              }}
            >
              synthex.social
            </span>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
