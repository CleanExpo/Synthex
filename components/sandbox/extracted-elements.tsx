'use client';

/**
 * Extracted Elements Component
 * Display hashtags and mentions found in content
 */

interface ExtractedElementsProps {
  hashtags: string[];
  mentions: string[];
}

export function ExtractedElements({ hashtags, mentions }: ExtractedElementsProps) {
  if (hashtags.length === 0 && mentions.length === 0) {
    return null;
  }

  return (
    <div className="p-4 bg-white/5 rounded-lg space-y-3">
      {hashtags.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Hashtags ({hashtags.length})</p>
          <div className="flex flex-wrap gap-2">
            {hashtags.map((tag, i) => (
              <span key={i} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
      {mentions.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">Mentions ({mentions.length})</p>
          <div className="flex flex-wrap gap-2">
            {mentions.map((mention, i) => (
              <span key={i} className="text-xs bg-cyan-500/20 text-cyan-300 px-2 py-1 rounded">
                {mention}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
