export default function GoogleBusinessInsightsLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4"
          >
            <div className="h-4 w-24 bg-white/[0.05] rounded-sm mb-2" />
            <div className="h-6 w-20 bg-white/[0.05] rounded-sm" />
          </div>
        ))}
      </div>

      <div className="mt-8 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-6">
        <div className="h-6 w-32 bg-white/[0.05] rounded-sm mb-4" />
        <div className="h-48 w-full bg-white/[0.05] rounded-sm" />
      </div>
    </div>
  );
}
