export default function ReferralsLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4"
          >
            <div className="h-4 w-20 bg-white/[0.05] rounded-sm mb-2" />
            <div className="h-6 w-24 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>

      <div className="mt-8 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm">
        <div className="border-b border-white/[0.06] p-4">
          <div className="h-5 w-32 bg-white/[0.05] rounded-sm" />
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border-b border-white/[0.06] p-4">
            <div className="space-y-2">
              <div className="h-4 w-40 bg-white/[0.05] rounded-sm" />
              <div className="h-3 w-32 bg-white/[0.05] rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
