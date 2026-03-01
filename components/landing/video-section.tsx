'use client';

const FEATURE_VIDEOS = [
  {
    title: 'AI Content Generator',
    description: 'Create engaging posts with AI',
    videoId: 'HbBBX0zYug4',
  },
  {
    title: 'Analytics Dashboard',
    description: 'Real-time engagement metrics',
    videoId: 'zS2cnmYxpf8',
  },
  {
    title: 'Smart Scheduler',
    description: 'Optimal posting times',
    videoId: 'r6ybAyj50qs',
  },
  {
    title: 'Viral Pattern Analytics',
    description: 'Discover what works',
    videoId: 'vCf79xJPbdI',
  },
];

/** Landing page video explainer section with main video and feature video grid */
export function VideoSection() {
  return (
    <section className="relative py-32 z-10">
      <div className="container mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-4 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full text-cyan-400 text-sm font-medium mb-6">
            See It In Action
          </span>
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Watch how <span className="text-cyan-400">Synthex</span> works
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            See our AI in action as it creates, optimizes, and publishes content across all your social platforms.
          </p>
        </div>

        {/* Main Platform Overview Video */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="relative rounded-2xl overflow-hidden border border-cyan-500/20 bg-[#0f172a]/80 shadow-2xl shadow-cyan-500/10">
            <div className="aspect-video">
              <iframe
                src="https://www.youtube.com/embed/7rRHU8xS-kU"
                title="Synthex — AI-Powered Marketing Agency"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold text-white mb-2">What is Synthex?</h3>
              <p className="text-gray-400 text-sm">Discover how Synthex uses AI to automate your entire social media marketing — from content creation to scheduling and analytics.</p>
            </div>
          </div>
        </div>

        {/* Feature Videos Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {FEATURE_VIDEOS.map((video, i) => (
            <div
              key={i}
              className="relative group rounded-2xl overflow-hidden border border-cyan-500/10 bg-[#0f172a]/60 hover:border-cyan-500/30 transition-all"
            >
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${video.videoId}`}
                  title={video.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-white mb-1">{video.title}</h4>
                <p className="text-gray-500 text-sm">{video.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Subscribe CTA */}
        <div className="text-center mt-12">
          <a
            href="https://www.youtube.com/@SynthexMedia-25?sub_confirmation=1"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            Subscribe to Our Channel
          </a>
        </div>
      </div>
    </section>
  );
}
