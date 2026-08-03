'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Brain, GripVertical, Lock, Move, Sparkles } from '@/components/icons';
import { cn } from '@/lib/utils';
import { VISION_LENSES, type VisionMap } from '@/lib/intentscape/contracts';
import {
  DEFAULT_LENS_POSITIONS,
  LENS_PRESENTATION,
  type CanvasPosition,
} from './presentation';

interface VisionCanvasProps {
  workspaceId: string;
  originSignal: string;
  visionMap: VisionMap | null;
  selectedHypothesisId: string | null;
  onSelectHypothesis: (id: string) => void;
}

const NODE_WIDTH_PERCENT = 24;
const NODE_HEIGHT_PERCENT = 18;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function VisionCanvas({
  workspaceId,
  originSignal,
  visionMap,
  selectedHypothesisId,
  onSelectHypothesis,
}: VisionCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    lens: keyof typeof DEFAULT_LENS_POSITIONS;
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const storageKey = `intentscape-canvas:${workspaceId}`;
  const [positions, setPositions] = useState(DEFAULT_LENS_POSITIONS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        setPositions(DEFAULT_LENS_POSITIONS);
        return;
      }
      const parsed = JSON.parse(stored) as Partial<
        Record<keyof typeof DEFAULT_LENS_POSITIONS, CanvasPosition>
      >;
      setPositions(current => ({ ...current, ...parsed }));
    } catch {
      setPositions(DEFAULT_LENS_POSITIONS);
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(positions));
    } catch {
      // Canvas arrangement is a disposable preference; storage failures are safe.
    }
  }, [positions, storageKey]);

  const findings = useMemo(
    () =>
      new Map(
        (visionMap?.lensFindings ?? []).map(finding => [finding.lens, finding])
      ),
    [visionMap]
  );

  const moveNode = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    const canvas = canvasRef.current;
    if (!drag || !canvas || event.pointerId !== drag.pointerId) return;
    const bounds = canvas.getBoundingClientRect();
    const x =
      ((event.clientX - bounds.left - drag.offsetX) / bounds.width) * 100;
    const y =
      ((event.clientY - bounds.top - drag.offsetY) / bounds.height) * 100;
    setPositions(current => ({
      ...current,
      [drag.lens]: {
        x: clamp(x, 1, 100 - NODE_WIDTH_PERCENT - 1),
        y: clamp(y, 1, 100 - NODE_HEIGHT_PERCENT - 1),
      },
    }));
  }, []);

  const stopMoving = useCallback((event: PointerEvent) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', moveNode);
    window.addEventListener('pointerup', stopMoving);
    window.addEventListener('pointercancel', stopMoving);
    return () => {
      window.removeEventListener('pointermove', moveNode);
      window.removeEventListener('pointerup', stopMoving);
      window.removeEventListener('pointercancel', stopMoving);
    };
  }, [moveNode, stopMoving]);

  function startMoving(
    lens: keyof typeof DEFAULT_LENS_POSITIONS,
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const node = event.currentTarget.closest('[data-lens-node]');
    const canvas = canvasRef.current;
    if (!node || !canvas) return;
    const nodeBounds = node.getBoundingClientRect();
    dragRef.current = {
      lens,
      pointerId: event.pointerId,
      offsetX: event.clientX - nodeBounds.left,
      offsetY: event.clientY - nodeBounds.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  return (
    <section
      aria-labelledby="vision-canvas-title"
      className="relative overflow-hidden rounded-[20px] border border-white/[0.12] bg-[rgba(15,23,42,0.90)] shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-sky-300/70">
            Vision field / movable map
          </p>
          <h2
            id="vision-canvas-title"
            className="font-[var(--font-space-grotesk)] text-lg font-medium text-slate-50"
          >
            Seven ways out of the obvious answer
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Move className="h-4 w-4" aria-hidden="true" />
          Drag the lenses to arrange your thinking
        </div>
      </div>

      <div className="grid min-h-[610px] grid-cols-1 lg:grid-cols-[190px_minmax(620px,1fr)_220px]">
        <aside className="relative z-10 flex flex-col justify-center border-b border-white/[0.08] bg-slate-950/80 p-4 lg:border-b-0 lg:border-r">
          <div className="rounded-[14px] border border-amber-400/25 bg-amber-400/[0.07] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">
                Human signal
              </span>
              <Lock className="h-4 w-4 text-amber-300" aria-hidden="true" />
            </div>
            <p className="line-clamp-8 text-sm leading-6 text-slate-200">
              {originSignal}
            </p>
            <p className="mt-4 border-t border-amber-300/15 pt-3 text-[11px] leading-5 text-amber-100/60">
              Provenance only. It cannot directly become the goal or select a
              tool.
            </p>
          </div>
        </aside>

        <div
          ref={canvasRef}
          className="relative hidden min-h-[610px] overflow-hidden bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.08),transparent_46%),linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:auto,32px_32px,32px_32px] lg:block"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-7 border-r border-dashed border-amber-300/30 bg-gradient-to-r from-amber-400/[0.07] to-transparent">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-90 whitespace-nowrap font-mono text-xs uppercase tracking-[0.24em] text-amber-200/55">
              authority membrane
            </span>
          </div>

          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="intentscape-line" x1="0" y1="0" x2="1" y2="0">
                <stop
                  offset="0%"
                  stopColor="var(--sx-info)"
                  stopOpacity="0.08"
                />
                <stop
                  offset="50%"
                  stopColor="var(--sx-info)"
                  stopOpacity="0.35"
                />
                <stop
                  offset="100%"
                  stopColor="var(--sx-success)"
                  stopOpacity="0.08"
                />
              </linearGradient>
            </defs>
            {VISION_LENSES.slice(0, -1).map((lens, index) => {
              const next = VISION_LENSES[index + 1]!;
              const from = positions[lens];
              const to = positions[next];
              return (
                <line
                  key={`${lens}-${next}`}
                  x1={`${from.x + NODE_WIDTH_PERCENT / 2}%`}
                  y1={`${from.y + NODE_HEIGHT_PERCENT / 2}%`}
                  x2={`${to.x + NODE_WIDTH_PERCENT / 2}%`}
                  y2={`${to.y + NODE_HEIGHT_PERCENT / 2}%`}
                  stroke="url(#intentscape-line)"
                  strokeWidth="1.5"
                  strokeDasharray="5 7"
                />
              );
            })}
          </svg>

          {VISION_LENSES.map(lens => {
            const detail = LENS_PRESENTATION[lens];
            const finding = findings.get(lens);
            const position = positions[lens];
            return (
              <article
                key={lens}
                data-lens-node
                className="absolute z-10 flex h-[18%] w-[24%] min-w-[156px] flex-col overflow-hidden rounded-[14px] border border-white/[0.12] bg-[rgba(10,18,34,0.92)] shadow-[0_8px_24px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-[border-color,box-shadow] hover:border-white/20"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  borderTopColor: detail.colour,
                }}
              >
                <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2">
                  <span
                    className="font-mono text-xs"
                    style={{ color: detail.colour }}
                  >
                    {detail.short}
                  </span>
                  <h3 className="min-w-0 flex-1 truncate font-[var(--font-space-grotesk)] text-xs font-medium text-slate-100">
                    {detail.label}
                  </h3>
                  <button
                    type="button"
                    onPointerDown={event => startMoving(lens, event)}
                    className="-m-2 flex h-11 w-11 touch-none items-center justify-center rounded-[10px] text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    aria-label={`Move ${detail.label}`}
                  >
                    <GripVertical className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
                  <p className="text-[11px] leading-4 text-slate-400">
                    {finding?.findings[0] ?? detail.prompt}
                  </p>
                  {finding && (
                    <p className="mt-2 font-mono text-xs uppercase tracking-wider text-emerald-300/70">
                      {finding.evidenceRefs.length} evidence links
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="grid gap-3 border-b border-white/[0.08] p-4 sm:grid-cols-2 lg:hidden">
          {VISION_LENSES.map(lens => {
            const detail = LENS_PRESENTATION[lens];
            const finding = findings.get(lens);
            return (
              <article
                key={lens}
                className="rounded-[14px] border border-white/[0.12] bg-white/[0.04] p-3"
                style={{ borderTopColor: detail.colour }}
              >
                <p
                  className="font-mono text-xs"
                  style={{ color: detail.colour }}
                >
                  {detail.short} / {detail.label}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-300">
                  {finding?.findings[0] ?? detail.prompt}
                </p>
              </article>
            );
          })}
        </div>

        <aside className="relative z-10 flex flex-col justify-center border-t border-white/[0.08] bg-slate-950/80 p-4 lg:border-l lg:border-t-0">
          <div className="mb-3 flex items-center gap-2">
            {visionMap ? (
              <Sparkles
                className="h-4 w-4 text-emerald-300"
                aria-hidden="true"
              />
            ) : (
              <Brain className="h-4 w-4 text-sky-300" aria-hidden="true" />
            )}
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
              Candidate directions
            </p>
          </div>
          <div className="space-y-2">
            {visionMap ? (
              visionMap.hypotheses.map((hypothesis, index) => (
                <button
                  key={hypothesis.id}
                  type="button"
                  onClick={() => onSelectHypothesis(hypothesis.id)}
                  aria-pressed={selectedHypothesisId === hypothesis.id}
                  className={cn(
                    'w-full rounded-[10px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                    selectedHypothesisId === hypothesis.id
                      ? 'border-emerald-400/40 bg-emerald-400/[0.09]'
                      : 'border-white/[0.1] bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.06]'
                  )}
                >
                  <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
                    Direction {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-200">
                    {hypothesis.title}
                  </span>
                  <span className="mt-2 block font-mono text-xs text-emerald-300/70">
                    {Math.round(hypothesis.confidence * 100)}% confidence
                  </span>
                </button>
              ))
            ) : (
              <div className="rounded-[14px] border border-dashed border-white/[0.14] p-4 text-center">
                <p className="text-xs leading-5 text-slate-400">
                  Add context, then let the agents construct causally different
                  directions.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
