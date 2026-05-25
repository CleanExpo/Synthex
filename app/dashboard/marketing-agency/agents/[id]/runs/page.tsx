import type { Metadata } from 'next';
import { AgentRunHistory } from '@/components/marketing-agency/agent/AgentRunHistory';

export const metadata: Metadata = {
  title: 'Agent Runs | Marketing Agency | Synthex',
};

export default function AgentRunsPage({ params }: { params: { id: string } }) {
  return (
    <main className="container mx-auto flex min-h-[60vh] flex-col gap-6 px-6 py-8">
      <AgentRunHistory agentId={params.id} />
    </main>
  );
}
