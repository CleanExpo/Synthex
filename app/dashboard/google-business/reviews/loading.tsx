export default function GoogleBusinessReviewsLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-8 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm p-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white/[0.05] rounded-sm flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 bg-white/[0.05] rounded-sm" />
                <div className="h-4 w-24 bg-white/[0.05] rounded-sm" />
                <div className="h-3 w-full bg-white/[0.05] rounded-sm" />
                <div className="h-3 w-5/6 bg-white/[0.05] rounded-sm" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
