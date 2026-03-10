import { SourceConnector, SourceResult } from '../types';
import { logger } from '@/lib/logger';

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract?: string;
  citationCount?: number;
  year?: number;
  authors?: { name: string }[];
  tldr?: { text: string };
  url?: string;
  externalIds?: { DOI?: string; ArXiv?: string };
}

interface SemanticScholarResponse {
  data: SemanticScholarPaper[];
  total?: number;
}

export class SemanticScholarConnector implements SourceConnector {
  readonly id = 'semantic-scholar';
  readonly name = 'Semantic Scholar';
  readonly type = 'academic' as const;
  readonly description = 'Academic paper search via Semantic Scholar API (214M+ papers)';
  readonly enabled = true;

  private readonly baseUrl = 'https://api.semanticscholar.org/graph/v1/paper/search';
  private readonly fields = 'title,abstract,citationCount,year,authors,tldr,url,externalIds';

  private getConfidence(citationCount: number | undefined, year: number | undefined): number {
    const count = citationCount ?? 0;
    const currentYear = new Date().getFullYear();
    const isRecent = year ? (currentYear - year) <= 5 : false;

    if (count > 50 && isRecent) return 0.9;
    if (count > 10) return 0.7;
    return 0.5;
  }

  async search(query: string): Promise<SourceResult[]> {
    try {
      const params = new URLSearchParams({
        query,
        limit: '5',
        fields: this.fields,
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers,
      });

      if (!response.ok) {
        logger.warn('Semantic Scholar API error', {
          status: response.status,
          query,
        });
        return [];
      }

      const data: SemanticScholarResponse = await response.json();

      if (!data.data || !Array.isArray(data.data)) {
        return [];
      }

      return data.data.map((paper): SourceResult => {
        const url =
          paper.url ||
          (paper.externalIds?.DOI
            ? `https://doi.org/${paper.externalIds.DOI}`
            : `https://www.semanticscholar.org/paper/${paper.paperId}`);

        const snippet =
          paper.tldr?.text ||
          (paper.abstract ? paper.abstract.slice(0, 200) + '...' : 'No abstract available.');

        return {
          title: paper.title || 'Untitled',
          url,
          snippet,
          sourceType: 'academic',
          sourceName: 'Semantic Scholar',
          confidence: this.getConfidence(paper.citationCount, paper.year),
          citationCount: paper.citationCount,
          year: paper.year,
          authors: paper.authors?.map((a) => a.name),
        };
      });
    } catch (error) {
      logger.warn('Semantic Scholar connector error', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
