import { NextRequest, NextResponse } from 'next/server';
import { exportProposal } from '@/lib/opportunity-review/database';
import {
  proposalResponse,
  resolveProposalContext,
} from '@/lib/opportunity-review/http';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return proposalResponse(async () => {
    const context = await resolveProposalContext(request);
    if (context instanceof NextResponse) return context;
    const { id } = await params;
    const bundle = await exportProposal(context, id);
    return NextResponse.json(bundle, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="synthex-proposal-${bundle.packetId}.json"`,
      },
    });
  });
}
