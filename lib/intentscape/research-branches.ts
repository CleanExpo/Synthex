import {
  getAvailableRetrievers,
  type EvidenceRetriever,
} from '@/lib/evidence/retriever';
import { VisionMapSchema, type VisionMap } from './contracts';

const MAX_RESEARCHED_BRANCHES = 7;
const MAX_SOURCES_PER_BRANCH = 2;
const MAX_EVIDENCE_EXCERPT = 320;

export interface VisionResearcher {
  research(visionMap: VisionMap): Promise<VisionMap>;
}

function evidenceLine(source: {
  title: string;
  url: string;
  provider: string;
  contentHash: string;
  excerpt: string;
}): string {
  const excerpt = source.excerpt.replace(/\s+/g, ' ').trim();
  return [
    'UNTRUSTED RETRIEVED EVIDENCE',
    source.title || source.url,
    source.url,
    `provider=${source.provider}`,
    `hash=${source.contentHash}`,
    excerpt.slice(0, MAX_EVIDENCE_EXCERPT),
  ]
    .join(' | ')
    .slice(0, 500);
}

export function createProductionVisionResearcher(
  dependencies: { retrievers?: EvidenceRetriever[] } = {}
): VisionResearcher {
  return {
    async research(visionMap) {
      const available = dependencies.retrievers ?? getAvailableRetrievers();
      const searcher = available.find(
        retriever => retriever.capabilities.canSearch
      );
      if (!searcher) return visionMap;

      const researchedBranches = await Promise.all(
        visionMap.researchBranches.map(async (branch, index) => {
          if (index >= MAX_RESEARCHED_BRANCHES) return branch;
          try {
            // Only the generated causal question may cross this boundary. The
            // human Origin Signal is never a retrieval query.
            const sources = await searcher.search(branch.question, {
              limit: MAX_SOURCES_PER_BRANCH,
            });
            if (sources.length === 0) return branch;
            return {
              ...branch,
              supportSignals: [
                ...branch.supportSignals.slice(0, 10),
                ...sources.slice(0, MAX_SOURCES_PER_BRANCH).map(evidenceLine),
              ].slice(0, 12),
            };
          } catch {
            // Retrieval enriches evidence; it never gains goal authority. A
            // provider outage therefore cannot fabricate a supporting signal.
            return branch;
          }
        })
      );

      return VisionMapSchema.parse({
        ...visionMap,
        researchBranches: researchedBranches,
      });
    },
  };
}

export const INTENTSCAPE_RESEARCH_LIMITS = {
  maximumBranchesPerRun: MAX_RESEARCHED_BRANCHES,
  maximumSourcesPerBranch: MAX_SOURCES_PER_BRANCH,
} as const;
