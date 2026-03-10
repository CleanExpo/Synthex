import { SourceConnector, SourceResult } from '../types';
import { logger } from '@/lib/logger';

interface DataGovAuResource {
  url?: string;
  name?: string;
  description?: string;
  format?: string;
}

interface DataGovAuPackage {
  id: string;
  title: string;
  notes?: string;
  url?: string;
  resources?: DataGovAuResource[];
  organization?: { title?: string };
}

interface DataGovAuResponse {
  result?: {
    results?: DataGovAuPackage[];
    count?: number;
  };
  success?: boolean;
}

export class GovAuConnector implements SourceConnector {
  readonly id = 'gov-au';
  readonly name = 'Australian Government';
  readonly type = 'government' as const;
  readonly description = 'Australian Government open data via data.gov.au';
  readonly enabled = true;

  private readonly baseUrl = 'https://data.gov.au/data/api/3/action/package_search';

  async search(query: string): Promise<SourceResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        rows: '5',
      });

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn('data.gov.au API error', {
          status: response.status,
          query,
        });
        return [];
      }

      const data: DataGovAuResponse = await response.json();

      if (!data.success || !data.result?.results) {
        return [];
      }

      return data.result.results.map((pkg): SourceResult => {
        // Prefer first resource URL, then package URL, then fallback
        const url =
          pkg.resources?.[0]?.url ||
          pkg.url ||
          `https://data.gov.au/dataset/${pkg.id}`;

        const snippet = pkg.notes
          ? pkg.notes.slice(0, 200) + (pkg.notes.length > 200 ? '...' : '')
          : `Australian Government dataset: ${pkg.title}`;

        const sourceName = pkg.organization?.title
          ? `Australian Government — ${pkg.organization.title}`
          : 'Australian Government';

        return {
          title: pkg.title || 'Untitled Dataset',
          url,
          snippet,
          sourceType: 'government',
          sourceName,
          confidence: 0.95,
        };
      });
    } catch (error) {
      logger.warn('Australian Government connector error', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}
