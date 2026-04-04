export default function CreativeSuiteLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8">
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-6"
            >
              <div className="h-5 w-32 bg-white/[0.05] rounded-sm mb-3" />
              <div className="h-4 w-full bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-6"
            >
              <div className="h-5 w-32 bg-white/[0.05] rounded-sm mb-3" />
              <div className="h-4 w-full bg-white/[0.05] rounded-sm" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
