export default function AwardsLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-56 bg-white/[0.05] rounded-sm" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
            <div className="h-4 w-24 bg-white/[0.05] rounded-sm mb-2" />
            <div className="h-8 w-12 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4 flex gap-3">
            <div className="h-10 w-10 bg-white/[0.05] rounded-sm flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-white/[0.05] rounded-sm" />
              <div className="h-3 w-full bg-white/[0.05] rounded-sm" />
              <div className="h-3 w-3/4 bg-white/[0.05] rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
