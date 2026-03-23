export default function ContentLibraryLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-6">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden"
          >
            <div className="aspect-square bg-white/[0.05]" />
            <div className="p-4 space-y-2">
              <div className="h-4 w-3/4 bg-white/[0.05] rounded-sm" />
              <div className="h-3 w-1/2 bg-white/[0.05] rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
