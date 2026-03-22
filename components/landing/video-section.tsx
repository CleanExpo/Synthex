'use client';

const FEATURE_VIDEOS = [
  {
    title: 'AI Content Generator',
    description:
      'Watch the AI create platform-native posts from a single brief',
    videoId: 'HbBBX0zYug4',
  },
  {
    title: 'Analytics Dashboard',
    description: 'Real-time engagement metrics across all 9 platforms',
    videoId: 'zS2cnmYxpf8',
  },
  {
    title: 'Smart Scheduler',
    description: 'AI-determined optimal posting windows, automated',
    videoId: 'r6ybAyj50qs',
  },
  {
    title: 'Viral Pattern Engine',
    description: 'Reverse-engineer what makes content spread',
    videoId: 'vCf79xJPbdI',
  },
];

/** Video section — normalised styling, Scientific Luxury borders */
export function VideoSection() {
  return (
    <section className="relative py-32 z-10">
      <div className="container mx-auto px-6">
        {/* Section header */}
        <div className="mb-16 flex flex-col lg:flex-row lg:items-end gap-6">
          <div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50 mb-4 block">
              See It In Action
            </span>
            <h2 className="text-4xl sm:text-5xl font-extralight tracking-tight text-white">
              Watch Synthex
              <br />
              <span className="text-orange-400">work in real time.</span>
            </h2>
          </div>
          <p className="text-white/40 text-sm max-w-sm leading-relaxed lg:ml-auto lg:text-right">
            Live demonstrations of the platform generating, scheduling, and
            optimising content autonomously.
          </p>
        </div>

        {/* Main overview video */}
        <div className="max-w-4xl mx-auto mb-[0.5px]">
          <div className="border-[0.5px] border-white/[0.06] bg-white/[0.02] overflow-hidden rounded-sm">
            <div className="aspect-video">
              <iframe
                src="https://www.youtube.com/embed/7rRHU8xS-kU"
                title="Synthex — Autonomous AI Marketing Platform Overview"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            <div className="px-6 py-5 border-t border-[0.5px] border-white/[0.06]">
              <h3 className="text-base font-medium text-white mb-1">
                What Is Synthex?
              </h3>
              <p className="text-sm text-white/40 leading-relaxed">
                A complete walkthrough of how Synthex autonomously manages your
                entire social media presence — from content creation to
                publishing and optimisation.
              </p>
            </div>
          </div>
        </div>

        {/* Feature videos */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-[0.5px] max-w-7xl mx-auto">
          {FEATURE_VIDEOS.map(video => (
            <div
              key={video.videoId}
              className="border-[0.5px] border-white/[0.06] bg-white/[0.01] hover:border-white/[0.1] transition-colors duration-200 overflow-hidden rounded-sm group"
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
              <div className="px-4 py-4 border-t border-[0.5px] border-white/[0.06]">
                <h4 className="text-sm font-medium text-white mb-1">
                  {video.title}
                </h4>
                <p className="text-xs text-white/40 leading-relaxed">
                  {video.description}
                </p>
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
            className="inline-flex items-center gap-3 px-6 py-3 bg-[#FF0000] hover:bg-[#CC0000] text-white text-sm font-medium rounded-sm transition-colors duration-200"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            Subscribe to Our Channel
          </a>
        </div>
      </div>
    </section>
  );
}
