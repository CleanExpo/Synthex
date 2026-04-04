export default function SearchConsolePropertiesLoading() {
  return (
    <div className="animate-pulse">
      <div className="border-b border-white/[0.06] pb-6">
        <div className="h-4 w-32 bg-white/[0.05] rounded-sm mb-3" />
        <div className="h-8 w-48 bg-white/[0.05] rounded-sm" />
      </div>

      <div className="mt-8 border-[0.5px] border-white/[0.06] bg-white/[0.01] rounded-sm overflow-hidden">
        <div className="border-b border-white/[0.06] p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
            <div className="h-4 w-24 bg-white/[0.05] rounded-sm" />
            <div className="h-4 w-20 bg-white/[0.05] rounded-sm" />
            <div className="h-4 w-20 bg-white/[0.05] rounded-sm" />
            <div className="h-4 w-20 bg-white/[0.05] rounded-sm" />
            <div className="h-4 w-16 bg-white/[0.05] rounded-sm" />
          </div>
        </div>

        {[...Array(6)].map((_, i) => (
          <div key={i} className="border-b border-white/[0.06] p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div className="h-4 w-32 bg-white/[0.05] rounded-sm" />
              <div className="h-4 w-12 bg-white/[0.05] rounded-sm" />
              <div className="h-4 w-12 bg-white/[0.05] rounded-sm" />
              <div className="h-4 w-12 bg-white/[0.05] rounded-sm" />
              <div className="h-4 w-14 bg-white/[0.05] rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
