import { cn } from '@/lib/utils';

export type StatusPillVariant =
  | 'draft'
  | 'staged'
  | 'awaiting_approval'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'intake'
  | 'verified'
  | 'grounded'
  | 'queued'
  | 'controlled';

const variantStyles: Record<
  StatusPillVariant,
  { bg: string; text: string; border: string; label: string }
> = {
  draft: {
    bg: 'bg-sx-bg-subtle',
    text: 'text-sx-text-secondary',
    border: 'border-white/[0.08]',
    label: 'Draft',
  },
  intake: {
    bg: 'bg-sx-bg-subtle',
    text: 'text-sx-text-secondary',
    border: 'border-white/[0.08]',
    label: 'Intake',
  },
  grounded: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-info',
    border: 'border-sx-info/30',
    label: 'Grounded',
  },
  verified: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-info',
    border: 'border-sx-info/30',
    label: 'Verified',
  },
  staged: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-info',
    border: 'border-sx-info/30',
    label: 'Staged',
  },
  awaiting_approval: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-warning',
    border: 'border-sx-warning/30',
    label: 'Awaiting approval',
  },
  approved: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-success',
    border: 'border-sx-success/30',
    label: 'Approved',
  },
  queued: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-intelligence',
    border: 'border-sx-intelligence/30',
    label: 'Queued',
  },
  scheduled: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-intelligence',
    border: 'border-sx-intelligence/30',
    label: 'Scheduled',
  },
  controlled: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-success',
    border: 'border-sx-success/30',
    label: 'Controlled',
  },
  published: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-text-primary',
    border: 'border-white/[0.08]',
    label: 'Published',
  },
  failed: {
    bg: 'bg-sx-bg-elevated',
    text: 'text-sx-danger',
    border: 'border-sx-danger/30',
    label: 'Failed',
  },
};

export interface StatusPillProps {
  variant: StatusPillVariant;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusPill({
  variant,
  label,
  size = 'sm',
  className,
}: StatusPillProps) {
  const styles = variantStyles[variant];
  const displayLabel = label ?? styles.label;

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center border font-medium',
        styles.bg,
        styles.text,
        styles.border,
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      {displayLabel}
    </span>
  );
}
