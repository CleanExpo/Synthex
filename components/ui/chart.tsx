'use client';

/**
 * Shadcn-style Chart primitives for Synthex
 * Wraps Recharts with ChartContainer, ChartTooltipContent, ChartLegendContent.
 * Uses Synthex amber design tokens: --chart-1 through --chart-5.
 */

import * as React from 'react';
import { Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';

// ─── Chart Config Type ────────────────────────────────────────────────────────

export type ChartConfig = {
  [key: string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    color?: string;
    theme?: Record<string, string>;
  };
};

// ─── Context ──────────────────────────────────────────────────────────────────

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error('useChart must be used inside <ChartContainer>');
  return ctx;
}

// ─── Amber CSS Variables ──────────────────────────────────────────────────────
// Primary palette: amber-600 → amber-300, charcoal, slate
const SYNTHEX_CHART_VARS: Record<string, string> = {
  '--chart-1': '#D97706', // amber-600
  '--chart-2': '#F59E0B', // amber-500
  '--chart-3': '#FBBF24', // amber-400
  '--chart-4': '#FCD34D', // amber-300
  '--chart-5': '#B45309', // amber-700 (darker)
  '--chart-twitter': '#1DA1F2',
  '--chart-linkedin': '#0077B5',
  '--chart-instagram': '#E4405F',
  '--chart-facebook': '#1877F2',
  '--chart-tiktok': '#69C9D0',
};

function buildCssVars(config: ChartConfig): React.CSSProperties {
  const overrides: Record<string, string> = {};
  let idx = 1;
  for (const [, value] of Object.entries(config)) {
    if (value.color) {
      overrides[`--color-${Object.keys(config)[idx - 1]}`] = value.color;
    }
    idx++;
  }
  return { ...SYNTHEX_CHART_VARS, ...overrides } as React.CSSProperties;
}

// ─── ChartContainer ───────────────────────────────────────────────────────────

export interface ChartContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  config: ChartConfig;
  children: React.ReactElement;
}

const ChartContainer = React.forwardRef<HTMLDivElement, ChartContainerProps>(
  ({ config, children, className, ...props }, ref) => {
    const cssVars = buildCssVars(config);
    return (
      <ChartContext.Provider value={{ config }}>
        <div
          ref={ref}
          style={cssVars}
          className={cn('w-full', className)}
          {...props}
        >
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      </ChartContext.Provider>
    );
  }
);
ChartContainer.displayName = 'ChartContainer';

// ─── ChartTooltip (re-export Recharts Tooltip) ────────────────────────────────

const ChartTooltip = Tooltip;

// ─── ChartTooltipContent ─────────────────────────────────────────────────────

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  dataKey?: string;
  color?: string;
  fill?: string;
}

interface ChartTooltipContentProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  labelFormatter?: (label: string) => React.ReactNode;
  formatter?: (value: number | string, name: string) => React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: 'dot' | 'line' | 'dashed';
  nameKey?: string;
  labelKey?: string;
  className?: string;
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  ChartTooltipContentProps
>(
  (
    {
      active,
      payload,
      label,
      labelFormatter,
      formatter,
      hideLabel = false,
      hideIndicator = false,
      indicator = 'dot',
      className,
    },
    ref
  ) => {
    const { config } = useChart();

    if (!active || !payload?.length) return null;

    const displayLabel = labelFormatter ? labelFormatter(label ?? '') : label;

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-white/10 bg-[#1A1A2E]/95 px-3 py-2 shadow-xl text-xs',
          className
        )}
      >
        {!hideLabel && displayLabel && (
          <p className="mb-1.5 font-medium text-white/70">{displayLabel}</p>
        )}
        <div className="flex flex-col gap-1">
          {payload.map((item, i) => {
            const key = (item.dataKey as string) ?? item.name ?? String(i);
            const itemConfig = config[key];
            const colour = item.color ?? item.fill ?? '#D97706';
            const displayName = itemConfig?.label ?? item.name ?? key;
            const rawValue = item.value ?? 0;
            const displayValue = formatter
              ? formatter(rawValue, key)
              : typeof rawValue === 'number'
                ? rawValue.toLocaleString()
                : rawValue;

            return (
              <div key={i} className="flex items-center gap-1.5">
                {!hideIndicator && (
                  <span
                    className={cn(
                      'shrink-0 rounded-full',
                      indicator === 'dot' ? 'h-2 w-2' : 'h-0.5 w-3'
                    )}
                    style={{ backgroundColor: colour }}
                  />
                )}
                <span className="text-white/60">{displayName}</span>
                <span className="ml-auto font-semibold text-white pl-3">
                  {displayValue}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = 'ChartTooltipContent';

// ─── ChartLegend (re-export Recharts Legend) ──────────────────────────────────

const ChartLegend = Legend;

// ─── ChartLegendContent ──────────────────────────────────────────────────────

interface LegendPayloadItem {
  value?: string;
  color?: string;
  dataKey?: string;
}

interface ChartLegendContentProps {
  payload?: LegendPayloadItem[];
  className?: string;
  hideIcon?: boolean;
  nameKey?: string;
}

const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  ChartLegendContentProps
>(({ payload, className, hideIcon = false }, ref) => {
  const { config } = useChart();
  if (!payload?.length) return null;

  return (
    <div ref={ref} className={cn('flex flex-wrap gap-3 text-xs', className)}>
      {payload.map((item, i) => {
        const key = (item.dataKey as string) ?? item.value ?? String(i);
        const itemConfig = config[key];
        const colour = item.color ?? '#D97706';
        const label = itemConfig?.label ?? item.value ?? key;

        return (
          <div key={i} className="flex items-center gap-1.5 text-white/60">
            {!hideIcon && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colour }}
              />
            )}
            {label}
          </div>
        );
      })}
    </div>
  );
});
ChartLegendContent.displayName = 'ChartLegendContent';

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
};
