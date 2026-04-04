export default function ExperimentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="mb-6">
        <div className="h-3 w-24 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
        <div className="h-px bg-white/[0.06] mt-5" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4">
            <div className="h-3 w-16 bg-white/[0.05] rounded-sm mb-2" />
            <div className="h-6 w-24 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
      <div className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-4" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-white/[0.03] rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
