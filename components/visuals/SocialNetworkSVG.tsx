'use client';

import { useEffect, useState } from 'react';

const platforms = [
  { name: 'Twitter/X', color: '#1DA1F2', icon: '𝕏', angle: 0 },
  { name: 'Instagram', color: '#E4405F', icon: '📷', angle: 60 },
  { name: 'LinkedIn', color: '#0077B5', icon: 'in', angle: 120 },
  { name: 'TikTok', color: '#FF0050', icon: '♪', angle: 180 },
  { name: 'Facebook', color: '#1877F2', icon: 'f', angle: 240 },
  { name: 'YouTube', color: '#FF0000', icon: '▶', angle: 300 },
];

export default function SocialNetworkSVG() {
  const [rotation, setRotation] = useState(0);
  const [pulseScale, setPulseScale] = useState(1);

  useEffect(() => {
    const rotationInterval = setInterval(() => {
      setRotation(r => (r + 0.3) % 360);
    }, 50);

    const pulseInterval = setInterval(() => {
      setPulseScale(s => s === 1 ? 1.05 : 1);
    }, 2000);

    return () => {
      clearInterval(rotationInterval);
      clearInterval(pulseInterval);
    };
  }, []);

  const centerX = 250;
  const centerY = 250;
  const radius = 150;

  return (
    <div className="w-full h-[500px] relative rounded-2xl overflow-hidden bg-[#030014]">
      {/* Animated background gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_50%,rgba(6,182,212,0.15),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_30%_20%,rgba(8,145,178,0.1),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_70%_80%,rgba(34,211,238,0.1),transparent)]" />
      </div>

      {/* Starfield effect */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(50)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5 + 0.2,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main SVG visualization */}
      <svg
        viewBox="0 0 500 500"
        className="w-full h-full relative z-10"
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <defs>
          {/* Central orb gradient */}
          <radialGradient id="centralOrb" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#67e8f9" />
            <stop offset="50%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0891b2" />
          </radialGradient>

          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Strong glow for connections */}
          <filter id="lineGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Platform gradients */}
          {platforms.map((platform, i) => (
            <radialGradient key={i} id={`platform${i}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={platform.color} stopOpacity="1" />
              <stop offset="100%" stopColor={platform.color} stopOpacity="0.6" />
            </radialGradient>
          ))}
        </defs>

        {/* Orbital rings */}
        <g opacity="0.3">
          <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#06b6d4" strokeWidth="1" strokeDasharray="5,5" />
          <circle cx={centerX} cy={centerY} r={radius * 0.7} fill="none" stroke="#67e8f9" strokeWidth="0.5" strokeDasharray="3,3" />
          <circle cx={centerX} cy={centerY} r={radius * 1.3} fill="none" stroke="#0891b2" strokeWidth="0.5" strokeDasharray="8,8" />
        </g>

        {/* Connection lines to platforms */}
        {platforms.map((platform, i) => {
          const angle = ((platform.angle + rotation) * Math.PI) / 180;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          return (
            <g key={`connection-${i}`}>
              {/* Connection line */}
              <line
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={platform.color}
                strokeWidth="2"
                strokeOpacity="0.4"
                filter="url(#lineGlow)"
              />
              {/* Animated particle on line */}
              <circle r="4" fill={platform.color} filter="url(#glow)">
                <animateMotion
                  dur={`${2 + i * 0.3}s`}
                  repeatCount="indefinite"
                  path={`M${centerX},${centerY} L${x},${y}`}
                />
              </circle>
            </g>
          );
        })}

        {/* Central SYNTHEX orb */}
        <g filter="url(#glow)">
          {/* Outer glow rings */}
          <circle
            cx={centerX}
            cy={centerY}
            r={50}
            fill="url(#centralOrb)"
            opacity="0.2"
            style={{ transform: `scale(${pulseScale})`, transformOrigin: 'center' }}
          />
          <circle
            cx={centerX}
            cy={centerY}
            r={40}
            fill="url(#centralOrb)"
            opacity="0.4"
          />
          {/* Core sphere */}
          <circle
            cx={centerX}
            cy={centerY}
            r={30}
            fill="url(#centralOrb)"
          />
          {/* Highlight */}
          <ellipse
            cx={centerX - 8}
            cy={centerY - 10}
            rx={12}
            ry={8}
            fill="white"
            opacity="0.3"
          />
        </g>

        {/* Platform nodes */}
        {platforms.map((platform, i) => {
          const angle = ((platform.angle + rotation) * Math.PI) / 180;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;

          return (
            <g key={`node-${i}`} style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${x}px ${y}px` }}>
              {/* Glow */}
              <circle
                cx={x}
                cy={y}
                r={25}
                fill={platform.color}
                opacity="0.3"
                filter="url(#glow)"
              />
              {/* Node background */}
              <circle
                cx={x}
                cy={y}
                r={18}
                fill={`url(#platform${i})`}
                stroke={platform.color}
                strokeWidth="2"
              />
              {/* Icon text */}
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="white"
                fontSize="14"
                fontWeight="bold"
              >
                {platform.icon}
              </text>
            </g>
          );
        })}

        {/* Central S logo */}
        <text
          x={centerX}
          y={centerY}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize="24"
          fontWeight="bold"
          style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: `${centerX}px ${centerY}px` }}
        >
          S
        </text>
      </svg>

      {/* Bottom label */}
      <div className="absolute bottom-4 left-4 right-4 text-center pointer-events-none">
        <p className="text-white/60 text-sm backdrop-blur-sm bg-black/20 rounded-full px-4 py-2 inline-block">
          All platforms connected through SYNTHEX
        </p>
      </div>
    </div>
  );
}
