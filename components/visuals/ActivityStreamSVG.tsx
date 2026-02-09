'use client';

import { useState, useEffect, useMemo } from 'react';

interface Activity {
  id: number;
  type: 'like' | 'comment' | 'share' | 'follow' | 'post';
  user: string;
  action: string;
  icon: string;
  color: string;
}

const typeConfig = {
  like: { color: '#ef4444', icon: '❤️' },
  comment: { color: '#3b82f6', icon: '💬' },
  share: { color: '#10b981', icon: '🔄' },
  follow: { color: '#8b5cf6', icon: '➕' },
  post: { color: '#f59e0b', icon: '📝' },
};

const initialActivities: Activity[] = [
  { id: 1, type: 'like', user: '@sarah', action: 'liked', icon: '❤️', color: '#ef4444' },
  { id: 2, type: 'comment', user: '@john', action: 'commented', icon: '💬', color: '#3b82f6' },
  { id: 3, type: 'share', user: '@emma', action: 'shared', icon: '🔄', color: '#10b981' },
  { id: 4, type: 'follow', user: '@alex', action: 'followed', icon: '➕', color: '#8b5cf6' },
  { id: 5, type: 'post', user: '@mike', action: 'posted', icon: '📝', color: '#f59e0b' },
  { id: 6, type: 'like', user: '@lisa', action: 'liked', icon: '❤️', color: '#ef4444' },
];

function FlowingParticle({ delay, color }: { delay: number; color: string }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full animate-flow-up"
      style={{
        left: `${10 + Math.random() * 80}%`,
        bottom: '-10px',
        backgroundColor: color,
        animationDelay: `${delay}s`,
        opacity: 0.6,
        boxShadow: `0 0 10px ${color}`,
      }}
    />
  );
}

export default function ActivityStreamSVG() {
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [pulseScale, setPulseScale] = useState(1);
  const [ringScale, setRingScale] = useState({ r1: 1, r2: 1, r3: 1 });

  // Generate new activities periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const types: Activity['type'][] = ['like', 'comment', 'share', 'follow', 'post'];
      const users = ['@user1', '@user2', '@user3', '@user4', '@user5', '@creator', '@brand'];
      const actions = ['liked', 'commented', 'shared', 'followed', 'posted'];

      const randomType = Math.floor(Math.random() * types.length);
      const config = typeConfig[types[randomType]];

      const newActivity: Activity = {
        id: Date.now(),
        type: types[randomType],
        user: users[Math.floor(Math.random() * users.length)],
        action: actions[randomType],
        color: config.color,
        icon: config.icon,
      };

      setActivities(prev => [newActivity, ...prev.slice(0, 5)]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Pulse animation
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setPulseScale(s => s === 1 ? 1.1 : 1);
    }, 1500);

    const ringInterval = setInterval(() => {
      setRingScale(prev => ({
        r1: prev.r1 === 1 ? 1.05 : 1,
        r2: prev.r2 === 1 ? 1.08 : 1,
        r3: prev.r3 === 1 ? 1.03 : 1,
      }));
    }, 800);

    return () => {
      clearInterval(pulseInterval);
      clearInterval(ringInterval);
    };
  }, []);

  const particles = useMemo(() => {
    return [...Array(20)].map((_, i) => ({
      delay: i * 0.5,
      color: Object.values(typeConfig)[i % 5].color,
    }));
  }, []);

  const activityCount = activities.length * 247;

  return (
    <div className="w-full h-[500px] relative rounded-2xl overflow-hidden bg-[#030014]">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_50%,rgba(139,92,246,0.2),transparent)]" />
      </div>

      {/* Starfield */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(60)].map((_, i) => (
          <div
            key={i}
            className="absolute w-0.5 h-0.5 bg-white rounded-full animate-pulse"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.2,
              animationDelay: `${Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      {/* Flowing particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((p, i) => (
          <FlowingParticle key={i} delay={p.delay} color={p.color} />
        ))}
      </div>

      {/* Central hub SVG */}
      <div className="absolute inset-0 flex items-center justify-center">
        <svg viewBox="0 0 400 400" className="w-80 h-80">
          <defs>
            <radialGradient id="hubGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="50%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#6d28d9" />
            </radialGradient>
            <filter id="hubGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="15" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Pulsing rings */}
          <circle
            cx="200"
            cy="200"
            r="120"
            fill="none"
            stroke="#a78bfa"
            strokeWidth="1"
            opacity="0.5"
            style={{ transform: `scale(${ringScale.r1})`, transformOrigin: 'center' }}
          />
          <circle
            cx="200"
            cy="200"
            r="100"
            fill="none"
            stroke="#c4b5fd"
            strokeWidth="0.5"
            opacity="0.3"
            style={{ transform: `scale(${ringScale.r2})`, transformOrigin: 'center' }}
          />
          <circle
            cx="200"
            cy="200"
            r="80"
            fill="none"
            stroke="#ddd6fe"
            strokeWidth="0.5"
            opacity="0.2"
            style={{ transform: `scale(${ringScale.r3})`, transformOrigin: 'center' }}
          />

          {/* Central hub */}
          <g filter="url(#hubGlow)">
            <circle
              cx="200"
              cy="200"
              r="50"
              fill="url(#hubGradient)"
              opacity="0.2"
              style={{ transform: `scale(${pulseScale})`, transformOrigin: 'center' }}
            />
            <circle cx="200" cy="200" r="40" fill="url(#hubGradient)" opacity="0.4" />
            <circle cx="200" cy="200" r="30" fill="url(#hubGradient)" />
            <ellipse cx="192" cy="190" rx="10" ry="6" fill="white" opacity="0.3" />
          </g>

          {/* Orbiting activity nodes */}
          {activities.slice(0, 6).map((activity, i) => {
            const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const radius = 100;
            const x = 200 + Math.cos(angle) * radius;
            const y = 200 + Math.sin(angle) * radius;

            return (
              <g key={activity.id}>
                {/* Connection line */}
                <line
                  x1="200"
                  y1="200"
                  x2={x}
                  y2={y}
                  stroke={activity.color}
                  strokeWidth="2"
                  opacity="0.3"
                />
                {/* Node glow */}
                <circle cx={x} cy={y} r="20" fill={activity.color} opacity="0.2" />
                {/* Node */}
                <circle cx={x} cy={y} r="12" fill={activity.color} />
                {/* Icon */}
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="12"
                >
                  {activity.icon}
                </text>
              </g>
            );
          })}

          {/* LIVE text */}
          <text
            x="200"
            y="200"
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize="12"
            fontWeight="bold"
          >
            LIVE
          </text>
        </svg>
      </div>

      {/* Stats display */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center">
        <p className="text-purple-400 font-bold text-lg">LIVE ACTIVITY</p>
        <p className="text-purple-300/70 text-sm">{activityCount.toLocaleString()} actions/min</p>
      </div>

      {/* Activity feed overlay */}
      <div className="absolute top-4 right-4 w-64 bg-black/70 backdrop-blur-xl rounded-xl p-4 border border-purple-500/30 shadow-[0_0_30px_rgba(139,92,246,0.2)]">
        <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Real-Time Activity
        </h3>
        <div className="space-y-2 max-h-32 overflow-y-auto">
          {activities.slice(0, 4).map((activity) => (
            <div
              key={activity.id}
              className="flex items-center space-x-2 text-xs text-white/80 py-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <span className="text-base">{activity.icon}</span>
              <span className="flex-1">
                <span className="font-semibold text-white">{activity.user}</span>{' '}
                <span className="text-white/60">{activity.action}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="absolute bottom-4 left-4 pointer-events-none">
        <p className="text-white/60 text-sm backdrop-blur-sm bg-black/20 rounded-full px-4 py-2 inline-block">
          {activityCount.toLocaleString()} interactions per minute
        </p>
      </div>

      {/* CSS for flow animation */}
      <style jsx>{`
        @keyframes flow-up {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translateY(-500px) scale(0.5);
            opacity: 0;
          }
        }
        .animate-flow-up {
          animation: flow-up 10s linear infinite;
        }
      `}</style>
    </div>
  );
}
