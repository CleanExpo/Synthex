export default function TestimonialsLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-56 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-6 flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-white/[0.05] rounded-sm" />
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-8 w-8 bg-white/[0.05] rounded-full" />
              <div>
                <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-1" />
                <div className="h-3 w-24 bg-white/[0.05] rounded-sm" />
              </div>
            </div>
            <div className="h-4 w-full bg-white/[0.05] rounded-sm mb-2" />
            <div className="h-4 w-3/4 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
