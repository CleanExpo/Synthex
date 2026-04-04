export default function GoogleBusinessPostsLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden"
          >
            <div className="aspect-video bg-white/[0.05]" />
            <div className="p-4 space-y-3">
              <div className="h-4 w-full bg-white/[0.05] rounded-sm" />
              <div className="h-4 w-5/6 bg-white/[0.05] rounded-sm" />
              <div className="h-3 w-20 bg-white/[0.05] rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
