'use client'

/**
 * ContentSuggestionsWidget — Sprint 3
 * Shows 3 AI-powered content recommendations on the dashboard.
 * Renders nothing if no recommendations are available.
 */

import useSWR from 'swr'
import { Sparkles, Loader2, Copy } from '@/components/icons'
import { toast } from 'sonner'

interface Recommendation {
  id: string
  title?: string
  description?: string
  type?: string
  platform?: string
  content?: string
  reasoning?: string
  priority?: number
}

interface RecommendationsResponse {
  recommendations: Recommendation[]
  total: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch')
  return res.json()
}

export function ContentSuggestionsWidget({ className }: { className?: string }) {
  const { data, isLoading } = useSWR<RecommendationsResponse>(
    '/api/recommendations?limit=3',
    fetchJson,
    { revalidateOnFocus: false }
  )

  const recommendations = data?.recommendations ?? []

  // Render nothing if no suggestions
  if (!isLoading && recommendations.length === 0) {
    return null
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy')
    })
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 p-5 space-y-4 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-cyan-400" />
        <span className="text-sm font-semibold text-white/90">Content Suggestions</span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 text-white/20 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1 group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {rec.platform && (
                    <span className="inline-block text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mb-1 capitalize">
                      {rec.platform}
                    </span>
                  )}
                  <p className="text-sm text-white/80 leading-snug">
                    {rec.title ?? rec.description ?? rec.content ?? 'Content idea'}
                  </p>
                  {rec.reasoning && (
                    <p className="text-xs text-white/40 mt-1 line-clamp-1">{rec.reasoning}</p>
                  )}
                </div>
                {(rec.content ?? rec.description) && (
                  <button
                    onClick={() => handleCopy(rec.content ?? rec.description ?? '')}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
                    title="Copy to clipboard"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
