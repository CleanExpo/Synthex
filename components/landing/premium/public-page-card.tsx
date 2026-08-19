import type { ComponentType } from 'react';
import { CheckCircle2 } from '@/components/icons';
import { cn } from '@/lib/utils';

export interface PublicPageCardProps {
  icon: ComponentType<{ className?: string }>;
  eyebrow?: string;
  title: string;
  copy: string;
  points?: string[];
  index?: number;
  className?: string;
}

export function PublicPageCard({
  icon: Icon,
  eyebrow,
  title,
  copy,
  points,
  index,
  className,
}: PublicPageCardProps) {
  return (
    <article
      className={cn(
        'landing-bento-card flex h-full min-w-0 flex-col rounded-card border border-white/[0.08] bg-sx-bg-elevated/80 p-6',
        className
      )}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-btn border border-sx-accent/20 bg-sx-accent/[0.08]">
          <Icon className="h-5 w-5 text-sx-accent" />
        </div>
        {typeof index === 'number' ? (
          <span className="text-xs font-medium text-sx-text-muted">
            {String(index + 1).padStart(2, '0')}
          </span>
        ) : null}
      </div>
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sx-accent">
          {eyebrow}
        </p>
      ) : null}
      <h3 className="mt-3 text-xl font-semibold text-sx-text-primary">
        {title}
      </h3>
      <p className="mt-3 text-sm leading-7 text-sx-text-secondary">{copy}</p>
      {points && points.length > 0 ? (
        <ul className="mt-5 space-y-2.5">
          {points.map(point => (
            <li
              key={point}
              className="flex gap-2.5 text-sm leading-6 text-sx-text-muted"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sx-success" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}
