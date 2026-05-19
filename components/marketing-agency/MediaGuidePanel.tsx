import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import type { MediaGuideItem } from '@/lib/marketing-agency/media-guide';

interface MediaGuidePanelProps {
  items: MediaGuideItem[];
}

function PlatformLogo({ logo }: { logo: MediaGuideItem['platformLogo'] }) {
  if (logo === 'LinkedIn') {
    return (
      <span
        aria-label="LinkedIn logo"
        className="inline-flex h-8 items-center rounded-sm bg-[#0A66C2] px-3 font-sans text-sm font-bold text-white"
      >
        Linked<span className="ml-0.5 rounded-[2px] bg-white px-1 text-[#0A66C2]">in</span>
      </span>
    );
  }

  return (
    <span
      aria-label="Facebook logo"
      className="inline-flex h-8 items-center rounded-sm bg-[#1877F2] px-3 font-sans text-sm font-bold lowercase text-white"
    >
      facebook
    </span>
  );
}

function PreviewFrame({ item }: { item: MediaGuideItem }) {
  return (
    <div className="flex min-h-[190px] items-center justify-center rounded-sm border border-white/10 bg-black/30 p-4">
      <div className={`relative w-full max-w-[180px] rounded-sm border border-white/20 bg-[#101827] ${item.previewClass}`}>
        <div className="absolute inset-3 rounded-sm border border-dashed border-white/25" />
        <div className="absolute left-3 top-3">
          <PlatformLogo logo={item.platformLogo} />
        </div>
        <div className="absolute inset-x-3 bottom-3 rounded-sm bg-white/10 px-2 py-1 text-center text-[10px] font-semibold text-white">
          CTA safe area
        </div>
      </div>
    </div>
  );
}

export function MediaGuidePanel({ items }: MediaGuidePanelProps) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-base font-light leading-none tracking-tight text-white">
          Media Size Guide
        </h2>
        <CardDescription>
          Logo-labelled previews with plain-language size and placement details.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {items.map(item => (
          <section key={item.storyboardId} className="grid gap-3 rounded-sm border border-white/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PlatformLogo logo={item.platformLogo} />
              <span className="rounded-sm border border-white/10 px-2 py-1 text-xs text-white/70">
                {item.format}
              </span>
            </div>
            <PreviewFrame item={item} />
            <div>
              <h3 className="text-sm font-semibold text-white">{item.title}</h3>
              <dl className="mt-3 grid gap-2 text-sm text-white/75">
                <div className="flex justify-between gap-4">
                  <dt className="text-white/60">Exact export size</dt>
                  <dd className="font-medium text-white">{item.pixelSize}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-white/60">Duration</dt>
                  <dd className="font-medium text-white">{item.durationLabel}</dd>
                </div>
                <div>
                  <dt className="text-white/60">Where it fits</dt>
                  <dd>{item.plainEnglishUse}</dd>
                </div>
                <div>
                  <dt className="text-white/60">Text and logo safety</dt>
                  <dd>{item.safeAreaNote}</dd>
                </div>
              </dl>
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
