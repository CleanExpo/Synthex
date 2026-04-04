import type { Metadata } from 'next';
import { AutonomousPostLog } from '@/components/autonomous/AutonomousPostLog';

export const metadata: Metadata = {
  title: 'Activity Log | Synthex',
  description:
    'A complete record of every auto-publish action Synthex has taken on your behalf.',
};

export default function ActivityPage() {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Every action Synthex has taken on your behalf — posts scheduled,
          published, paused, and failed.
        </p>
      </div>

      <AutonomousPostLog />
    </div>
  );
}
