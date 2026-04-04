import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND, PERSONA_COLOURS } from '../lib/colors';
import type { PersonaEntry } from '../lib/types';

interface PersonaCardProps {
  persona: PersonaEntry;
  /** Whether to show the large "speaking" card or a small sidebar card */
  variant?: 'speaker' | 'sidebar';
}

export const PersonaCard: React.FC<PersonaCardProps> = ({
  persona,
  variant = 'speaker',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const colour = PERSONA_COLOURS[persona.id] ?? BRAND.accent;
  const slideIn = spring({ frame, fps, config: { damping: 18 } });
  const glowPulse = Math.sin(frame * 0.08) * 0.3 + 0.7;

  if (variant === 'sidebar') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderRadius: 12,
          backgroundColor: 'rgba(18, 18, 26, 0.8)',
          border: `1px solid ${colour}40`,
          opacity: interpolate(slideIn, [0, 1], [0, 0.7]),
        }}
      >
        <AvatarCircle persona={persona} colour={colour} size={36} />
        <div style={{ fontSize: 14, color: BRAND.textMuted }}>
          {persona.title.split(' — ')[0]}
        </div>
      </div>
    );
  }

  // Speaker variant — large card bottom-left
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 80,
        left: 60,
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        padding: '16px 28px 16px 16px',
        borderRadius: 20,
        backgroundColor: BRAND.bgCard,
        border: `2px solid ${colour}60`,
        boxShadow: `0 0 ${30 * glowPulse}px ${colour}30`,
        transform: `translateX(${interpolate(slideIn, [0, 1], [-200, 0])}px)`,
        opacity: interpolate(slideIn, [0, 1], [0, 1]),
      }}
    >
      <AvatarCircle persona={persona} colour={colour} size={64} />
      <div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: BRAND.text,
            marginBottom: 2,
          }}
        >
          {persona.voice_name !== 'TBD' ? persona.voice_name : persona.id}
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: colour,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          {persona.title}
        </div>
      </div>
    </div>
  );
};

/** Circular avatar — loads PNG if available, falls back to coloured initial */
const AvatarCircle: React.FC<{
  persona: PersonaEntry;
  colour: string;
  size: number;
}> = ({ persona, colour, size }) => {
  const initial = persona.id.charAt(0).toUpperCase();

  // Try to load the persona image; fall back to coloured circle
  const imagePath = `personas/${persona.filename}`;
  let hasImage = false;
  try {
    staticFile(imagePath);
    hasImage = true;
  } catch {
    hasImage = false;
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: `${colour}30`,
        border: `2px solid ${colour}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {hasImage ? (
        <Img
          src={staticFile(imagePath)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span
          style={{
            fontSize: size * 0.45,
            fontWeight: 800,
            color: colour,
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
};
