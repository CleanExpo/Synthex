import { Metadata } from 'next'
import { InsightsPageClient } from '@/components/insights/InsightsPageClient'

export const metadata: Metadata = {
  title: 'AI Insights | Synthex',
  description: 'Autonomous AI agent surfaces content opportunities every 4 hours.',
}

/**
 * AI Insights dashboard page — server wrapper.
 * Client component handles data fetching via SWR.
 */
export default function InsightsPage() {
  return <InsightsPageClient />
}
