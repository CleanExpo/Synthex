import { DashboardPanel } from '@/components/dashboard/DashboardAtmosphere';

export default function AdvancedLoading() {
  return (
    <div className="w-full max-w-none space-y-8 pt-2 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-24 bg-white/5 rounded-sm" />
        <div className="h-9 w-64 bg-white/5 rounded-sm" />
        <div className="h-4 w-96 max-w-full bg-white/5 rounded-sm" />
      </div>
      <DashboardPanel>
        <div className="h-10 w-full max-w-xl bg-white/5 rounded-sm" />
      </DashboardPanel>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-32 bg-white/5 rounded-sm border border-white/6"
          />
        ))}
      </div>
    </div>
  );
}
