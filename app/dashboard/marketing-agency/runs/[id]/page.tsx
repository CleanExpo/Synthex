import type { Metadata } from 'next';
import { AgentRunDetail } from '@/components/marketing-agency/agent/AgentRunDetail';

export const metadata: Metadata = {
  title: 'Agent Run | Marketing Agency | Synthex',
};

export default function AgentRunPage({ params }: { params: { id: string } }) {
  return (
    <main className="container mx-auto flex min-h-[60vh] flex-col gap-6 px-6 py-8">
      <AgentRunDetail runId={params.id} />
    </main>
  );
}
