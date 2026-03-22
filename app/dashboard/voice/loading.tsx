export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
            <div className="h-4 w-24 bg-white/[0.05] rounded-sm mb-2" />
            <div className="h-8 w-16 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-white/[0.06] p-4 space-y-2">
            <div className="h-4 w-5/6 bg-white/[0.05] rounded-sm" />
            <div className="h-3 w-3/4 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
