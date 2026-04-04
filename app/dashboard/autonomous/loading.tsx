export default function AutonomousLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-6"
          >
            <div className="h-6 w-40 bg-white/[0.05] rounded-sm mb-4" />
            <div className="space-y-2">
              <div className="h-4 w-full bg-white/[0.05] rounded-sm" />
              <div className="h-4 w-5/6 bg-white/[0.05] rounded-sm" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-6">
        <div className="h-6 w-32 bg-white/[0.05] rounded-sm mb-4" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 w-full bg-white/[0.05] rounded-sm" />
          ))}
        </div>
      </div>
    </div>
  );
}
