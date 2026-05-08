'use client';

/**
 * Motion panel — sweep signature preview from ra.motion.
 *
 * The actual sweep runs at 18 frames @ 30fps in Remotion. This is a CSS-keyframe
 * replica that lets you eyeball the rhythm without a render. Easing curves are
 * pulled live from ra.ts.
 */

import { useEffect, useRef } from 'react';
import { ra } from '@unite-group/brand-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const FPS = 30;
const baseDurationMs = (ra.motion.durations.base / FPS) * 1000;
const transitionMs = (ra.motion.transitionFrames / FPS) * 1000;

export function MotionPanel() {
  const sweepRef = useRef<HTMLDivElement>(null);

  // Restart the sweep animation on a 3.5s loop so the user can see it cycle.
  useEffect(() => {
    const el = sweepRef.current;
    if (!el) return;
    const interval = setInterval(() => {
      el.classList.remove('vb-sweep-run');
      void el.offsetWidth;            // force reflow
      el.classList.add('vb-sweep-run');
    }, 3500);
    el.classList.add('vb-sweep-run');
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Motion — sweep signature</CardTitle>
            <CardDescription>
              {ra.motion.durations.base} frames @ 30fps · {ra.motion.transitionFrames}f transition · expo curves
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-[10px] capitalize">
            {ra.motion.signature}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* Sweep preview stage */}
        <div
          className="relative h-48 w-full overflow-hidden rounded-lg border border-border"
          style={{ backgroundColor: ra.colour.secondary }}
        >
          <div
            ref={sweepRef}
            className="vb-sweep absolute inset-y-0 left-0 flex items-center px-8"
            style={{
              width: '100%',
              backgroundColor: ra.colour.primary,
              color: '#F5F7F8',
              fontFamily: ra.typography.display.family,
              fontWeight: 700,
              fontSize: '2rem',
            }}
          >
            One System.
          </div>
          <style jsx>{`
            .vb-sweep {
              transform: translateX(-100%);
            }
            .vb-sweep.vb-sweep-run {
              animation-name: vb-sweep-in;
              animation-duration: ${baseDurationMs}ms;
              animation-timing-function: ${ra.motion.easing.in};
              animation-fill-mode: forwards;
            }
            @keyframes vb-sweep-in {
              from {
                transform: translateX(-100%);
              }
              to {
                transform: translateX(0);
              }
            }
          `}</style>
        </div>

        {/* Easing + duration table */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Durations</p>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
              <li>fast · {ra.motion.durations.fast}f · {Math.round((ra.motion.durations.fast / FPS) * 1000)}ms</li>
              <li>base · {ra.motion.durations.base}f · {Math.round(baseDurationMs)}ms</li>
              <li>slow · {ra.motion.durations.slow}f · {Math.round((ra.motion.durations.slow / FPS) * 1000)}ms</li>
              <li>transition · {ra.motion.transitionFrames}f · {Math.round(transitionMs)}ms</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Easing</p>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
              <li>in · expo-out</li>
              <li>out · expo-in</li>
              <li>inOut · expo-in-out</li>
            </ul>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Easing curves (raw)</p>
            <ul className="mt-2 flex flex-col gap-1 font-mono text-[10px] text-muted-foreground">
              <li>{ra.motion.easing.in}</li>
              <li>{ra.motion.easing.out}</li>
              <li>{ra.motion.easing.inOut}</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
