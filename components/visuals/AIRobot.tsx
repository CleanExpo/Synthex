'use client';

import { useEffect, useState, useMemo } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  delay: number;
  gray: number;
  rotation: number;
}

/**
 * SYNTHEX_DROID_01 - Autonomous Marketing Android
 *
 * Character Specs:
 * - Type: Autonomous Marketing Android
 * - Physique: Sleek, Humanoid, Minimalist
 * - Primary Material: Polished White Ceramic / Powder-coated Aluminum (Satin-Gloss)
 * - Secondary Material: Carbon-Fiber Mesh Joints (Matte Black / Charcoal)
 * - Emissive Elements: Cyan-Blue Neon Pulse Linings (#00E5FF)
 * - Optics: Humanoid Iris with Soft Blue Glow
 * - Pose: "The Thinker" - Right hand resting on chin, contemplative
 */
export default function AIRobot() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [pulsePhase, setPulsePhase] = useState(0);

  // Generate dispersion particles
  useEffect(() => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 55; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: 10 + Math.random() * 80,
        size: 2 + Math.random() * 14,
        opacity: 0.15 + Math.random() * 0.6,
        delay: Math.random() * 8,
        gray: 60 + Math.random() * 140,
        rotation: Math.random() * 45,
      });
    }
    setParticles(newParticles);
  }, []);

  // Pulse animation for emissive elements
  useEffect(() => {
    const interval = setInterval(() => {
      setPulsePhase(p => (p + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const pulseOpacity = useMemo(() => {
    return 0.6 + 0.4 * Math.sin((pulsePhase / 100) * Math.PI * 2);
  }, [pulsePhase]);

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {/* Particle Dispersion Effect - Emanating from robot's left side */}
      <div className="absolute left-0 top-0 w-2/5 h-full pointer-events-none overflow-visible z-0">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: `rgb(${p.gray}, ${p.gray}, ${p.gray})`,
              opacity: p.opacity,
              transform: `rotate(${p.rotation}deg)`,
              animation: `particleDisperse ${12 + Math.random() * 8}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* SVG Droid - SYNTHEX_DROID_01 */}
      <svg
        viewBox="0 0 450 600"
        className="relative w-full h-full max-w-[420px] max-h-[560px] z-10"
        style={{ filter: 'drop-shadow(0 25px 50px rgba(0,0,0,0.15))' }}
      >
        <defs>
          {/* Primary Material: Polished White Ceramic / Powder-coated Aluminum */}
          <linearGradient id="ceramicWhite" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="25%" stopColor="#F8F9FA" />
            <stop offset="50%" stopColor="#F1F3F5" />
            <stop offset="75%" stopColor="#E9ECEF" />
            <stop offset="100%" stopColor="#DEE2E6" />
          </linearGradient>

          <linearGradient id="ceramicHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>

          {/* Secondary Material: Carbon-Fiber Mesh Joints */}
          <linearGradient id="carbonFiber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3D3D3D" />
            <stop offset="50%" stopColor="#2D2D2D" />
            <stop offset="100%" stopColor="#1A1A1A" />
          </linearGradient>

          {/* Emissive: Cyan-Blue Neon Pulse */}
          <linearGradient id="cyanPulse" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#00E5FF" stopOpacity="1" />
            <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.2" />
          </linearGradient>

          <radialGradient id="eyeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00E5FF" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#00A5C4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#006080" stopOpacity="0.3" />
          </radialGradient>

          <radialGradient id="irisGradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#40F0FF" />
            <stop offset="50%" stopColor="#00E5FF" />
            <stop offset="100%" stopColor="#0099AA" />
          </radialGradient>

          {/* Glow filter for emissive elements */}
          <filter id="cyanGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#000" floodOpacity="0.12" />
          </filter>

          {/* Reflection pattern */}
          <pattern id="reflectionLines" patternUnits="userSpaceOnUse" width="4" height="4">
            <rect width="4" height="4" fill="transparent" />
            <line x1="0" y1="4" x2="4" y2="0" stroke="white" strokeWidth="0.5" opacity="0.1" />
          </pattern>
        </defs>

        <g filter="url(#softShadow)">
          {/* === TORSO / BODY === */}
          {/* Main chest piece - ceramic white */}
          <ellipse cx="225" cy="380" rx="95" ry="55" fill="url(#ceramicWhite)" />
          <path
            d="M140 350 Q140 300 180 280 L270 280 Q310 300 310 350 L310 420 Q310 450 280 460 L170 460 Q140 450 140 420 Z"
            fill="url(#ceramicWhite)"
          />
          {/* Chest highlight */}
          <ellipse cx="220" cy="340" rx="50" ry="25" fill="url(#ceramicHighlight)" opacity="0.5" />

          {/* Chest center piece (darker accent) */}
          <ellipse cx="225" cy="380" rx="30" ry="35" fill="url(#carbonFiber)" />
          <ellipse cx="225" cy="380" rx="18" ry="22" fill="#2A2A2A" />
          {/* Core glow */}
          <ellipse cx="225" cy="380" rx="8" ry="10" fill="url(#eyeGlow)" opacity={pulseOpacity} filter="url(#cyanGlow)" />

          {/* Chest seam lines with cyan pulse */}
          <path
            d="M175 320 Q225 310 275 320"
            fill="none"
            stroke="url(#cyanPulse)"
            strokeWidth="2"
            opacity={pulseOpacity}
            filter="url(#cyanGlow)"
          />
          <path
            d="M160 360 L160 420"
            fill="none"
            stroke="url(#cyanPulse)"
            strokeWidth="1.5"
            opacity={pulseOpacity * 0.7}
            filter="url(#cyanGlow)"
          />
          <path
            d="M290 360 L290 420"
            fill="none"
            stroke="url(#cyanPulse)"
            strokeWidth="1.5"
            opacity={pulseOpacity * 0.7}
            filter="url(#cyanGlow)"
          />

          {/* === NECK === */}
          {/* Neck hydraulics - carbon fiber with cyan accents */}
          <rect x="195" y="230" width="60" height="55" rx="8" fill="url(#carbonFiber)" />
          <ellipse cx="225" cy="230" rx="35" ry="12" fill="url(#ceramicWhite)" />
          <ellipse cx="225" cy="285" rx="40" ry="15" fill="url(#ceramicWhite)" />

          {/* Neck hydraulic lines */}
          <rect x="205" y="240" width="3" height="40" rx="1.5" fill="#00E5FF" opacity={pulseOpacity * 0.8} filter="url(#cyanGlow)" />
          <rect x="220" y="238" width="3" height="44" rx="1.5" fill="#00E5FF" opacity={pulseOpacity} filter="url(#cyanGlow)" />
          <rect x="235" y="240" width="3" height="40" rx="1.5" fill="#00E5FF" opacity={pulseOpacity * 0.8} filter="url(#cyanGlow)" />

          {/* === HEAD === */}
          {/* Main head shape - sleek oval */}
          <ellipse cx="225" cy="140" rx="75" ry="95" fill="url(#ceramicWhite)" />

          {/* Head contour highlight */}
          <ellipse cx="200" cy="100" rx="45" ry="40" fill="url(#ceramicHighlight)" opacity="0.6" />

          {/* Cranial seam - cyan pulse */}
          <path
            d="M160 100 Q225 70 290 100"
            fill="none"
            stroke="url(#cyanPulse)"
            strokeWidth="2"
            opacity={pulseOpacity}
            filter="url(#cyanGlow)"
          />
          <path
            d="M155 140 Q155 80 225 60 Q295 80 295 140"
            fill="none"
            stroke="url(#cyanPulse)"
            strokeWidth="1.5"
            opacity={pulseOpacity * 0.5}
            filter="url(#cyanGlow)"
          />

          {/* Face plate - slightly recessed */}
          <ellipse cx="225" cy="155" rx="55" ry="65" fill="#F1F3F5" opacity="0.5" />

          {/* === EYES - Humanoid Iris with Soft Blue Glow === */}
          {/* Left eye socket */}
          <ellipse cx="190" cy="140" rx="20" ry="22" fill="#E9ECEF" />
          <ellipse cx="190" cy="140" rx="16" ry="18" fill="#1A1A1A" />
          {/* Left iris */}
          <ellipse cx="190" cy="140" rx="12" ry="14" fill="url(#irisGradient)" filter="url(#cyanGlow)" />
          <ellipse cx="190" cy="140" rx="5" ry="6" fill="#003D4D" />
          {/* Left eye highlight */}
          <circle cx="185" cy="135" r="4" fill="white" opacity="0.8" />
          <circle cx="193" cy="145" r="2" fill="white" opacity="0.5" />

          {/* Right eye socket */}
          <ellipse cx="260" cy="140" rx="20" ry="22" fill="#E9ECEF" />
          <ellipse cx="260" cy="140" rx="16" ry="18" fill="#1A1A1A" />
          {/* Right iris */}
          <ellipse cx="260" cy="140" rx="12" ry="14" fill="url(#irisGradient)" filter="url(#cyanGlow)" />
          <ellipse cx="260" cy="140" r="5" fill="#003D4D" />
          {/* Right eye highlight */}
          <circle cx="255" cy="135" r="4" fill="white" opacity="0.8" />
          <circle cx="263" cy="145" r="2" fill="white" opacity="0.5" />

          {/* === NOSE / SENSOR === */}
          <path
            d="M220 165 L225 180 L230 165"
            fill="none"
            stroke="#DEE2E6"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* === MOUTH / SPEAKER GRILLE === */}
          <rect x="200" y="195" width="50" height="3" rx="1.5" fill="#CED4DA" />
          <rect x="207" y="202" width="36" height="2" rx="1" fill="#DEE2E6" />
          <rect x="212" y="208" width="26" height="2" rx="1" fill="#E9ECEF" />

          {/* === EAR PIECES === */}
          <ellipse cx="150" cy="140" rx="12" ry="25" fill="url(#ceramicWhite)" />
          <ellipse cx="150" cy="140" rx="6" ry="15" fill="url(#carbonFiber)" />
          <rect x="147" y="130" width="2" height="20" rx="1" fill="#00E5FF" opacity={pulseOpacity * 0.6} filter="url(#cyanGlow)" />

          <ellipse cx="300" cy="140" rx="12" ry="25" fill="url(#ceramicWhite)" />
          <ellipse cx="300" cy="140" rx="6" ry="15" fill="url(#carbonFiber)" />
          <rect x="298" y="130" width="2" height="20" rx="1" fill="#00E5FF" opacity={pulseOpacity * 0.6} filter="url(#cyanGlow)" />

          {/* === LEFT ARM (Down at side) === */}
          {/* Shoulder */}
          <ellipse cx="120" cy="320" rx="30" ry="40" fill="url(#ceramicWhite)" />
          {/* Upper arm */}
          <rect x="95" y="330" width="40" height="80" rx="18" fill="url(#ceramicWhite)" transform="rotate(12 115 370)" />
          {/* Elbow joint - carbon fiber */}
          <ellipse cx="100" cy="420" rx="18" ry="20" fill="url(#carbonFiber)" />
          {/* Elbow glow */}
          <ellipse cx="100" cy="420" rx="6" ry="7" fill="#00E5FF" opacity={pulseOpacity * 0.5} filter="url(#cyanGlow)" />
          {/* Forearm */}
          <rect x="80" y="430" width="35" height="70" rx="15" fill="url(#ceramicWhite)" transform="rotate(8 97 465)" />
          {/* Wrist joint */}
          <ellipse cx="85" cy="505" rx="14" ry="16" fill="url(#carbonFiber)" />
          {/* Hand */}
          <ellipse cx="80" cy="530" rx="16" ry="20" fill="url(#ceramicWhite)" />

          {/* Arm segment glow lines */}
          <line x1="110" y1="345" x2="105" y2="405" stroke="#00E5FF" strokeWidth="2" opacity={pulseOpacity * 0.6} filter="url(#cyanGlow)" />
          <line x1="90" y1="445" x2="85" y2="495" stroke="#00E5FF" strokeWidth="2" opacity={pulseOpacity * 0.6} filter="url(#cyanGlow)" />

          {/* === RIGHT ARM (Thinker pose - hand on chin) === */}
          {/* Shoulder */}
          <ellipse cx="330" cy="320" rx="30" ry="40" fill="url(#ceramicWhite)" />
          {/* Upper arm - angled up */}
          <rect x="315" y="280" width="40" height="75" rx="18" fill="url(#ceramicWhite)" transform="rotate(-25 335 315)" />
          {/* Elbow joint */}
          <ellipse cx="340" cy="255" rx="18" ry="20" fill="url(#carbonFiber)" />
          {/* Elbow glow */}
          <ellipse cx="340" cy="255" rx="6" ry="7" fill="#00E5FF" opacity={pulseOpacity * 0.5} filter="url(#cyanGlow)" />
          {/* Forearm - going up to chin */}
          <rect x="300" y="185" width="35" height="75" rx="15" fill="url(#ceramicWhite)" transform="rotate(-10 318 220)" />
          {/* Wrist joint */}
          <ellipse cx="295" cy="195" rx="14" ry="16" fill="url(#carbonFiber)" />

          {/* Hand at chin */}
          <ellipse cx="280" cy="195" rx="18" ry="22" fill="url(#ceramicWhite)" />
          {/* Fingers resting on chin */}
          <rect x="262" y="178" width="9" height="28" rx="4.5" fill="url(#ceramicWhite)" transform="rotate(-8 266 192)" />
          <rect x="273" y="175" width="9" height="32" rx="4.5" fill="url(#ceramicWhite)" transform="rotate(-3 277 191)" />
          <rect x="284" y="176" width="9" height="30" rx="4.5" fill="url(#ceramicWhite)" transform="rotate(3 288 191)" />
          <rect x="294" y="180" width="8" height="26" rx="4" fill="url(#ceramicWhite)" transform="rotate(8 298 193)" />

          {/* Right arm glow lines */}
          <line x1="340" y1="290" x2="340" y2="265" stroke="#00E5FF" strokeWidth="2" opacity={pulseOpacity * 0.6} filter="url(#cyanGlow)" />
          <line x1="310" y1="245" x2="300" y2="200" stroke="#00E5FF" strokeWidth="2" opacity={pulseOpacity * 0.6} filter="url(#cyanGlow)" />
        </g>
      </svg>

      {/* Ambient glow behind the droid */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 55% 45%, rgba(0, 229, 255, ${0.03 + 0.02 * Math.sin((pulsePhase / 100) * Math.PI * 2)}) 0%, transparent 70%)`,
        }}
      />

      {/* CSS Animations */}
      <style jsx global>{`
        @keyframes particleDisperse {
          0% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 0.6;
          }
          25% {
            transform: translate(-20px, -10px) rotate(15deg) scale(0.9);
            opacity: 0.4;
          }
          50% {
            transform: translate(-35px, 5px) rotate(-10deg) scale(0.85);
            opacity: 0.5;
          }
          75% {
            transform: translate(-15px, -15px) rotate(20deg) scale(0.75);
            opacity: 0.25;
          }
          100% {
            transform: translate(0, 0) rotate(0deg) scale(1);
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
