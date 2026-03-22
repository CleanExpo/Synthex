'use client';

import * as React from 'react';
import {
  Activity,
  ArrowRight,
  Files,
  Flower,
  GalleryVerticalEnd,
  MapPin,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import * as RechartsPrimitive from 'recharts';
import { cn } from '@/lib/utils';

// ---- Chart config type ----
const THEMES = { light: '', dark: '.dark' } as const;

type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  );
};

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context)
    throw new Error('useChart must be used within a <ChartContainer />');
  return context;
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(
    ([, c]) => c.theme || c.color
  );
  if (!colorConfig.length) return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) =>
              `${prefix} [data-chart=${id}] {\n${colorConfig
                .map(([key, itemConfig]) => {
                  const color =
                    itemConfig.theme?.[
                      theme as keyof typeof itemConfig.theme
                    ] || itemConfig.color;
                  return color ? `  --color-${key}: ${color};` : null;
                })
                .filter(Boolean)
                .join('\n')}\n}`
          )
          .join('\n'),
      }}
    />
  );
};

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    config: ChartConfig;
    children: React.ComponentProps<
      typeof RechartsPrimitive.ResponsiveContainer
    >['children'];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, '')}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          'flex aspect-video justify-center text-xs',
          '[&_.recharts-cartesian-axis-tick_text]:fill-white/40',
          '[&_.recharts-cartesian-grid_line]:stroke-white/[0.06]',
          '[&_.recharts-surface]:outline-none',
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = 'Chart';

const ChartTooltip = RechartsPrimitive.Tooltip as unknown as React.FC<
  RechartsPrimitive.TooltipProps<number, string>
>;

function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== 'object' || payload === null) return undefined;
  const payloadObj = payload as Record<string, unknown>;
  const payloadPayload =
    'payload' in payloadObj &&
    typeof payloadObj.payload === 'object' &&
    payloadObj.payload !== null
      ? (payloadObj.payload as Record<string, unknown>)
      : undefined;
  let configLabelKey = key;
  if (key in payloadObj && typeof payloadObj[key] === 'string') {
    configLabelKey = payloadObj[key] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === 'string'
  ) {
    configLabelKey = payloadPayload[key] as string;
  }
  return configLabelKey in config
    ? config[configLabelKey]
    : (config[key] as unknown as
        | (typeof config)[keyof typeof config]
        | undefined);
}

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  {
    active?: boolean;
    payload?: Array<Record<string, unknown>>;
    label?: React.ReactNode;
    labelFormatter?: (
      label: unknown,
      payload: Array<unknown>
    ) => React.ReactNode;
    labelClassName?: string;
    formatter?: (
      value: unknown,
      name: unknown,
      item: unknown,
      index: number,
      payload: unknown
    ) => React.ReactNode;
    color?: string;
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: 'line' | 'dot' | 'dashed';
    nameKey?: string;
    labelKey?: string;
  } & React.ComponentProps<'div'>
>(
  (
    {
      active,
      payload,
      className,
      indicator = 'dot',
      hideLabel = false,
      hideIndicator = false,
      label,
      labelFormatter,
      labelClassName,
      formatter,
      color,
      nameKey,
      labelKey,
    },
    ref
  ) => {
    const { config } = useChart();

    const tooltipLabel = React.useMemo(() => {
      if (hideLabel || !payload?.length) return null;
      const [item] = payload;
      const key = `${labelKey || item.dataKey || item.name || 'value'}`;
      const itemConfig = getPayloadConfigFromPayload(config, item, key);
      const value =
        !labelKey && typeof label === 'string'
          ? config[label as keyof typeof config]?.label || label
          : itemConfig?.label;
      if (labelFormatter) {
        return (
          <div className={cn('font-medium', labelClassName)}>
            {labelFormatter(value, payload)}
          </div>
        );
      }
      if (!value) return null;
      return (
        <div className={cn('font-medium', labelClassName)}>
          {value as React.ReactNode}
        </div>
      );
    }, [
      label,
      labelFormatter,
      payload,
      hideLabel,
      labelClassName,
      config,
      labelKey,
    ]);

    if (!active || !payload?.length) return null;

    const nestLabel = payload.length === 1 && indicator !== 'dot';

    return (
      <div
        ref={ref}
        className={cn(
          'grid min-w-[8rem] items-start gap-1.5 rounded-sm',
          'border-[0.5px] border-white/[0.06] bg-[#0a1628] px-2.5 py-1.5 text-xs shadow-xl',
          className
        )}
      >
        {!nestLabel ? tooltipLabel : null}
        <div className="grid gap-1.5">
          {payload.map((item, index) => {
            const key = `${nameKey || item.name || item.dataKey || 'value'}`;
            const itemConfig = getPayloadConfigFromPayload(config, item, key);
            const indicatorColor =
              color ||
              (item.payload as Record<string, string>)?.fill ||
              (item.color as string);
            return (
              <div
                key={item.dataKey as string}
                className={cn(
                  'flex w-full flex-wrap items-stretch gap-2',
                  indicator === 'dot' && 'items-center'
                )}
              >
                {formatter && item?.value !== undefined && item.name ? (
                  formatter(item.value, item.name, item, index, item.payload)
                ) : (
                  <>
                    {itemConfig?.icon ? (
                      <itemConfig.icon />
                    ) : (
                      !hideIndicator && (
                        <div
                          className={cn('shrink-0 rounded-[2px]', {
                            'h-2.5 w-2.5': indicator === 'dot',
                            'w-1': indicator === 'line',
                            'w-0 border-[1.5px] border-dashed bg-transparent':
                              indicator === 'dashed',
                          })}
                          style={
                            {
                              '--color-bg': indicatorColor,
                              '--color-border': indicatorColor,
                              backgroundColor: 'var(--color-bg)',
                              borderColor: 'var(--color-border)',
                            } as React.CSSProperties
                          }
                        />
                      )
                    )}
                    <div
                      className={cn(
                        'flex flex-1 justify-between leading-none',
                        nestLabel ? 'items-end' : 'items-center'
                      )}
                    >
                      <div className="grid gap-1.5">
                        {nestLabel ? tooltipLabel : null}
                        <span className="text-white/40">
                          {(itemConfig?.label as React.ReactNode) ||
                            (item.name as React.ReactNode)}
                        </span>
                      </div>
                      {item.value != null && (
                        <span className="font-mono font-medium tabular-nums text-white">
                          {typeof item.value === 'number'
                            ? (item.value as number).toLocaleString()
                            : String(item.value)}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);
ChartTooltipContent.displayName = 'ChartTooltip';

// ---- Dotted world map ----
const DottedWorldMap = () => {
  const dots: { cx: number; cy: number }[] = [];
  for (let row = 0; row < 22; row++) {
    for (let col = 0; col < 48; col++) {
      const offset = row % 2 === 0 ? 0 : 1.25;
      dots.push({ cx: col * 2.5 + offset, cy: row * 2.5 });
    }
  }
  return (
    <svg viewBox="0 0 120 55" className="w-full h-auto text-orange-400/20">
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={0.4} fill="currentColor" />
      ))}
      <circle cx={28} cy={18} r={1.2} fill="#22d3ee" opacity={0.8} />
      <circle cx={28} cy={18} r={2.5} fill="#22d3ee" opacity={0.2} />
    </svg>
  );
};

// ---- Chart data ----
const chartData = [
  { month: 'May', campaigns: 56, posts: 224 },
  { month: 'June', campaigns: 90, posts: 300 },
  { month: 'July', campaigns: 126, posts: 252 },
  { month: 'Aug', campaigns: 205, posts: 410 },
  { month: 'Sep', campaigns: 200, posts: 126 },
  { month: 'Oct', campaigns: 400, posts: 800 },
];

const chartConfig: ChartConfig = {
  campaigns: {
    label: 'Campaigns',
    color: '#22d3ee',
  },
  posts: {
    label: 'Posts Published',
    color: '#0e7490',
  },
};

function MonitoringChart() {
  return (
    <ChartContainer className="h-60 aspect-auto" config={chartConfig}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="fillCampaigns" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-campaigns)"
              stopOpacity={0.6}
            />
            <stop
              offset="55%"
              stopColor="var(--color-campaigns)"
              stopOpacity={0.05}
            />
          </linearGradient>
          <linearGradient id="fillPosts" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-posts)"
              stopOpacity={0.6}
            />
            <stop
              offset="55%"
              stopColor="var(--color-posts)"
              stopOpacity={0.05}
            />
          </linearGradient>
        </defs>
        <XAxis hide />
        <YAxis hide />
        <CartesianGrid vertical={false} horizontal={false} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          strokeWidth={2}
          dataKey="posts"
          type="monotone"
          fill="url(#fillPosts)"
          stroke="var(--color-posts)"
        />
        <Area
          strokeWidth={2}
          dataKey="campaigns"
          type="monotone"
          fill="url(#fillCampaigns)"
          stroke="var(--color-campaigns)"
        />
      </AreaChart>
    </ChartContainer>
  );
}

// ---- Activity feed messages ----
interface FeedMessage {
  title: string;
  time: string;
  content: string;
  gradient: string;
}

const feedMessages: FeedMessage[] = [
  {
    title: 'Campaign Published',
    time: '1m ago',
    content: 'Your Q4 Instagram campaign is now live.',
    gradient: 'from-orange-400 to-orange-300',
  },
  {
    title: 'AI Copy Generated',
    time: '3m ago',
    content: '8 post variants generated for review.',
    gradient: 'from-orange-500 to-orange-400',
  },
  {
    title: 'Billing Updated',
    time: '6m ago',
    content: 'Your Pro subscription renewed successfully.',
    gradient: 'from-orange-500 to-orange-400',
  },
  {
    title: 'Integration Connected',
    time: '10m ago',
    content: 'LinkedIn OAuth connected to your workspace.',
    gradient: 'from-sky-400 to-blue-700',
  },
  {
    title: 'Analytics Report',
    time: '12m ago',
    content: 'Dashboard insights updated with latest metrics.',
    gradient: 'from-orange-400 to-orange-500',
  },
  {
    title: 'Weekly Recap',
    time: '15m ago',
    content: "Here's what your team accomplished this week.",
    gradient: 'from-orange-400 to-orange-500',
  },
];

const ActivityFeed = () => {
  return (
    <div className="w-full max-w-sm h-[280px] bg-[#0a1628] p-2 overflow-hidden relative">
      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#0a1628] to-transparent z-10" />
      <div className="space-y-2 relative z-0">
        {feedMessages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-3 items-start p-3 rounded-sm cursor-pointer',
              'border-[0.5px] border-white/[0.06] bg-white/[0.02]',
              'hover:bg-orange-500/[0.04] transition-colors duration-200',
              'opacity-0'
            )}
            style={{
              animation: `scaleUp 0.3s ease ${i * 300}ms forwards`,
            }}
          >
            <div
              className={cn(
                'w-8 h-8 min-w-[2rem] min-h-[2rem] rounded-sm flex-shrink-0',
                'bg-gradient-to-br',
                msg.gradient
              )}
            />
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                {msg.title}
                <span className="text-xs text-white/40 before:content-['•'] before:mr-1">
                  {msg.time}
                </span>
              </div>
              <p className="text-xs text-white/60 mt-0.5 line-clamp-1">
                {msg.content}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---- Feature card with premium candy styling ----
function FeatureCard({
  icon,
  title,
  subtitle,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col gap-3 p-4 transition-all duration-300',
        'rounded-lg overflow-hidden group'
      )}
      style={{
        background:
          'linear-gradient(135deg, rgba(18,18,30,0.6) 0%, rgba(26,15,35,0.5) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,107,53,0.2)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background =
          'linear-gradient(135deg, rgba(255,107,53,0.1) 0%, rgba(244,114,182,0.08) 100%)';
        el.style.boxShadow = '0 0 30px rgba(255,107,53,0.3)';
        el.style.borderColor = 'rgba(255,214,10,0.4)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background =
          'linear-gradient(135deg, rgba(18,18,30,0.6) 0%, rgba(26,15,35,0.5) 100%)';
        el.style.boxShadow = 'none';
        el.style.borderColor = 'rgba(255,107,53,0.2)';
      }}
    >
      <div className="flex items-center gap-4">
        <div>
          <span className="text-xs flex items-center gap-2 text-white/40 mb-4">
            {icon}
            {title}
          </span>
          <h3 className="text-lg font-normal text-white">
            {subtitle} <span className="text-white/60">{description}</span>
          </h3>
        </div>
      </div>

      {/* Decorative card corner */}
      <div
        className={cn(
          'absolute bottom-0 right-0 w-24 h-20 sm:w-32 sm:h-28 md:w-40 md:h-32',
          'border-[0.5px] border-t border-l border-white/[0.06] rounded-tl-xl overflow-hidden',
          'bg-[#080e1a]'
        )}
      />

      {/* Arrow icon with candy glow */}
      <div
        className={cn(
          'absolute bottom-2 right-2 p-3 flex items-center gap-2 z-10',
          'rounded-full transition-all duration-300',
          'group-hover:-rotate-45'
        )}
        style={{
          background:
            'linear-gradient(135deg, rgba(255,107,53,0.2) 0%, rgba(255,214,10,0.15) 100%)',
          border: '1px solid rgba(255,107,53,0.4)',
          boxShadow: '0 0 15px rgba(255,107,53,0.3)',
        }}
      >
        <ArrowRight className="w-4 h-4 text-orange-400" />
      </div>
    </div>
  );
}

// ---- Main export ----
export function FeaturesSection() {
  const featuredCasestudy = {
    tags: 'Platform Metrics',
    title: 'How we scaled to 1M+ posts',
    subtitle:
      'without a single second of downtime, using smart AI scheduling and real-time monitoring',
  };

  return (
    <section className="py-24 bg-[#080e1a]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-orange-400 uppercase tracking-widest mb-3">
            Platform Highlights
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Everything Running in Real-Time
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            From audience analytics to AI-generated content — see the platform
            working for you, live.
          </p>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 md:grid-rows-2">
        {/* 1. MAP — Top Left */}
        <div
          className={cn(
            'relative overflow-hidden p-4',
            'border-[0.5px] border-white/[0.06] bg-[#0a1628]'
          )}
        >
          <div className="flex items-center gap-2 text-sm text-white/40 mb-4">
            <MapPin className="w-4 h-4 text-orange-400" />
            Synthex Analytics
          </div>
          <h3 className="text-xl font-normal text-white">
            Visualise audience activity across regions.{' '}
            <span className="text-white/60">
              Track, analyse, and optimise geographically.
            </span>
          </h3>

          <div className="relative mt-4">
            <div
              className={cn(
                'absolute top-16 left-1/2 -translate-x-1/2 z-10',
                'px-3 py-1 bg-[#0a1628] text-white rounded-sm text-xs font-medium shadow',
                'flex items-center gap-2 border-[0.5px] border-orange-500/20'
              )}
            >
              <span className="text-orange-400">●</span> Last connection from AU
            </div>
            <DottedWorldMap />
          </div>
        </div>

        {/* 2. FEATURED — Top Right */}
        <div
          className={cn(
            'flex flex-col justify-between gap-4 p-6',
            'border-[0.5px] border-white/[0.06] bg-[#0a1628]'
          )}
        >
          <div>
            <span className="text-xs flex items-center gap-2 text-white/40">
              <GalleryVerticalEnd className="w-4 h-4 text-orange-400" />
              {featuredCasestudy.tags}
            </span>
            <h3 className="text-xl font-normal text-white mt-2">
              {featuredCasestudy.title}{' '}
              <span className="text-white/60">
                {featuredCasestudy.subtitle}
              </span>
            </h3>
          </div>
          <div className="flex justify-center items-center w-full">
            <ActivityFeed />
          </div>
        </div>

        {/* 3. CHART — Bottom Left */}
        <div
          className={cn(
            'p-6 space-y-4',
            'border-[0.5px] border-white/[0.06] bg-[#0a1628]'
          )}
        >
          <div className="flex items-center gap-2 text-sm text-white/40 mb-4">
            <Activity className="w-4 h-4 text-orange-400" />
            Synthex Analytics
          </div>
          <h3 className="text-xl font-normal text-white">
            Real-time performance tracking for campaigns.{' '}
            <span className="text-white/60">
              Optimise your publishing decisions instantly.
            </span>
          </h3>
          <MonitoringChart />
        </div>

        {/* 4. FEATURE CARDS — Bottom Right */}
        <div className="grid sm:grid-cols-2 border-[0.5px] border-white/[0.06]">
          <FeatureCard
            icon={<Files className="w-4 h-4 text-orange-400" />}
            title="AI-Generated Content"
            subtitle="Ready to publish blocks"
            description="Drop AI-generated copy directly into any campaign with one click."
          />
          <FeatureCard
            icon={<Flower className="w-4 h-4 text-orange-400" />}
            title="Brand Customisation"
            subtitle="Customise with ease"
            description="Design your campaigns exactly the way you want with full flexibility."
          />
        </div>
      </div>
    </section>
  );
}

export default FeaturesSection;
