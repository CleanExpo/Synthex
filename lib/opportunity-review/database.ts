import { prisma } from '@/lib/prisma';
import { createOpportunityReviewService } from './service';

const service = createOpportunityReviewService(prisma);
export const { createProposal, listProposals, reviewProposal, exportProposal } =
  service;
