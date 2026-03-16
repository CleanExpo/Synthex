import type { Metadata } from 'next'
import { AutonomousPageClient } from '@/components/autonomous/AutonomousPageClient'

export const metadata: Metadata = {
  title: 'Autonomous | Synthex',
  description: 'Give natural language instructions and let AI execute them as workflows.',
}

export default function AutonomousPage() {
  return <AutonomousPageClient />
}
