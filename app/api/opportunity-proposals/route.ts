import { NextRequest, NextResponse } from 'next/server';
import {
  listProposals,
  createProposal,
  reviewProposal,
} from '@/lib/opportunity-review/database';
import {
  CaptureProposalSchema,
  ReviewActionSchema,
} from '@/lib/opportunity-review/schema';
import {
  proposalResponse,
  readProposalBody,
  resolveProposalContext,
} from '@/lib/opportunity-review/http';

export async function GET(request: NextRequest) {
  return proposalResponse(async () => {
    const context = await resolveProposalContext(request);
    if (context instanceof NextResponse) return context;
    const items = await listProposals(context);
    return NextResponse.json({ items, total: items.length });
  });
}

export async function POST(request: NextRequest) {
  return proposalResponse(async () => {
    const context = await resolveProposalContext(request, true);
    if (context instanceof NextResponse) return context;
    const result = await createProposal(
      context,
      CaptureProposalSchema.parse(await readProposalBody(request))
    );
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  });
}
export async function PATCH(request: NextRequest) {
  return proposalResponse(async () => {
    const context = await resolveProposalContext(request, true);
    if (context instanceof NextResponse) return context;
    const item = await reviewProposal(
      context,
      ReviewActionSchema.parse(await readProposalBody(request))
    );
    return NextResponse.json({ item });
  });
}
