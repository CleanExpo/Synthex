'use client';

/**
 * Video Script Preview
 *
 * Displays the AI-generated script with scenes, voiceover,
 * and visual descriptions before rendering.
 */

import { FileText, Clock, Hash } from '@/components/icons';

interface Scene {
  sceneNumber: number;
  duration: string;
  voiceover: string;
  visualDescription: string;
  textOverlay?: string;
}

interface ScriptContent {
  title: string;
  hook?: string;
  scenes: Scene[];
  callToAction?: string;
  totalDuration: string;
  style: string;
  suggestedMusic?: string;
  hashtags?: string[];
}

interface VideoScriptPreviewProps {
  script: ScriptContent;
}

export function VideoScriptPreview({ script }: VideoScriptPreviewProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-white font-medium flex items-center gap-2">
          <FileText className="w-4 h-4 text-cyan-400" />
          Script Preview
        </h4>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          {script.totalDuration}
        </div>
      </div>

      {/* Hook */}
      {script.hook && (
        <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/10">
          <span className="text-xs font-medium text-cyan-400 uppercase tracking-wide">Opening Hook</span>
          <p className="text-white text-sm mt-1">{script.hook}</p>
        </div>
      )}

      {/* Scenes */}
      <div className="space-y-3">
        {script.scenes.map((scene) => (
          <div
            key={scene.sceneNumber}
            className="p-3 rounded-lg bg-white/[0.02] border border-white/5"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-400">
                Scene {scene.sceneNumber}
              </span>
              <span className="text-xs text-gray-500">{scene.duration}</span>
            </div>
            <p className="text-white text-sm mb-1.5">{scene.voiceover}</p>
            <p className="text-gray-500 text-xs italic">{scene.visualDescription}</p>
            {scene.textOverlay && (
              <div className="mt-1.5 inline-block px-2 py-0.5 rounded bg-white/5 text-xs text-gray-300">
                Text: {scene.textOverlay}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      {script.callToAction && (
        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
          <span className="text-xs font-medium text-emerald-400 uppercase tracking-wide">Call to Action</span>
          <p className="text-white text-sm mt-1">{script.callToAction}</p>
        </div>
      )}

      {/* Hashtags */}
      {script.hashtags && script.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Hash className="w-3 h-3 text-gray-500 mt-0.5" />
          {script.hashtags.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-white/5 text-gray-400 px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Music suggestion */}
      {script.suggestedMusic && (
        <p className="text-xs text-gray-500">
          Suggested music: {script.suggestedMusic}
        </p>
      )}
    </div>
  );
}
