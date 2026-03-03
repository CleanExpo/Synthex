import { Metadata } from 'next'
import { BrandVoicePageClient } from '@/components/brand-voice/BrandVoicePageClient'

export const metadata: Metadata = {
  title: 'Brand Voice | Synthex',
  description: 'AI content quality review queue. Approve or reject AI-generated content before publishing.',
}

/**
 * Brand Voice dashboard page — server wrapper.
 * Client component handles data fetching via SWR.
 */
export default function BrandVoicePage() {
  return <BrandVoicePageClient />
}
