'use client';

import { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { pickBestBusinessSlots } from '@/lib/dashboard/best-business-schedule';
import type { OptimalTimeSlot } from '@/hooks/use-optimal-times';
import type { BestBusinessSlot } from '@/lib/dashboard/best-business-schedule';

interface BestScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: OptimalTimeSlot[];
  weekStart: Date;
  existing: Date[];
  isLoading: boolean;
  onBookSlot: (at: Date, platform: string) => void;
}

export function BestScheduleDialog({
  open,
  onOpenChange,
  slots,
  weekStart,
  existing,
  isLoading,
  onBookSlot,
}: BestScheduleDialogProps) {
  const plan = useMemo(
    () =>
      pickBestBusinessSlots({
        slots,
        weekStart,
        existing,
        count: 5,
      }),
    [slots, weekStart, existing]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-950 border-white/10 max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-[family-name:var(--font-space-grotesk)] font-light text-white text-xl">
            Best week for this business
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-white/45 leading-relaxed">
          Five quiet hours this week when similar accounts get seen. Nothing
          goes out until you write the post and book the time.
        </p>

        {isLoading ? (
          <p className="text-sm text-white/50">Finding quiet hours…</p>
        ) : plan.length === 0 ? (
          <p className="text-sm text-white/50">
            This week is full, or every strong hour has already passed. Open
            next week and try again.
          </p>
        ) : (
          <ol className="space-y-2">
            {plan.map(slot => (
              <BestSlotRow
                key={slot.at.toISOString()}
                slot={slot}
                onBook={() => {
                  onBookSlot(slot.at, slot.platform);
                  onOpenChange(false);
                }}
              />
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BestSlotRow({
  slot,
  onBook,
}: {
  slot: BestBusinessSlot;
  onBook: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">
          {slot.at.toLocaleString('en-AU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </p>
        <p className="text-xs text-white/40 capitalize">
          Strongest on {slot.platform} · score {Math.round(slot.score)}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        onClick={onBook}
        className="shrink-0 bg-orange-500 hover:bg-orange-400 text-black font-medium"
      >
        Write here
      </Button>
    </li>
  );
}
