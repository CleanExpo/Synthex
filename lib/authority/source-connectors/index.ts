import { SourceResult } from '../types';
import { SemanticScholarConnector } from './semantic-scholar';
import { GovAuConnector } from './gov-au';
import { IndustryRegistryConnector } from './industry-registry';
import { ClaudeWebSearchConnector } from './claude-web-search';

export const SOURCE_CONNECTORS = [
  new SemanticScholarConnector(),
  new GovAuConnector(),
  new IndustryRegistryConnector(),
  new ClaudeWebSearchConnector(),
];

export function getConnector(id: string) {
  return SOURCE_CONNECTORS.find(c => c.id === id);
}

export async function searchAllConnectors(query: string, enabledOnly = true): Promise<SourceResult[]> {
  const connectors = enabledOnly ? SOURCE_CONNECTORS.filter(c => c.enabled) : SOURCE_CONNECTORS;

  const results = await Promise.allSettled(
    connectors.map(connector => connector.search(query))
  );

  const allResults: SourceResult[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allResults.push(...result.value);
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allResults.filter(r => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  // Sort by confidence descending
  return deduped.sort((a, b) => b.confidence - a.confidence);
}

export function getConnectorStatus() {
  return SOURCE_CONNECTORS.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type,
    enabled: c.enabled,
  }));
}
