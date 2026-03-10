import { SourceConnector, SourceResult } from '../types';
import { logger } from '@/lib/logger';

interface AsicSearchResult {
  name?: string;
  abn?: string;
  status?: string;
}

const IICRC_STANDARDS: Record<string, string> = {
  S500: 'https://www.iicrc.org/page/s500',
  S520: 'https://www.iicrc.org/page/s520',
  S700: 'https://www.iicrc.org/page/s700',
};

const IICRC_DESCRIPTIONS: Record<string, string> = {
  S500: 'IICRC S500 Standard and Reference Guide for Professional Water Damage Restoration',
  S520: 'IICRC S520 Standard and Reference Guide for Professional Mould Remediation',
  S700: 'IICRC S700 Standard and Reference Guide for Professional Textile Cleaning',
};

const NCC_REFERENCES: Record<string, string> = {
  NCC: 'https://ncc.abcb.gov.au/',
  BCA: 'https://ncc.abcb.gov.au/',
};

const NCC_DESCRIPTIONS: Record<string, string> = {
  NCC: 'National Construction Code (NCC) — Australian Building Codes Board',
  BCA: 'Building Code of Australia (BCA) — Part of the National Construction Code',
};

export class IndustryRegistryConnector implements SourceConnector {
  readonly id = 'industry-registry';
  readonly name = 'Industry Registry';
  readonly type = 'industry' as const;
  readonly description =
    'IICRC standards, NCC/BCA references, and ASIC ABN business registry lookup';
  readonly enabled = true;

  private matchStaticReferences(query: string): SourceResult[] {
    const results: SourceResult[] = [];
    const upperQuery = query.toUpperCase();

    // Check IICRC standards
    for (const [code, url] of Object.entries(IICRC_STANDARDS)) {
      if (upperQuery.includes('IICRC') || upperQuery.includes(code)) {
        results.push({
          title: IICRC_DESCRIPTIONS[code] || `IICRC ${code} Standard`,
          url,
          snippet: `Industry standard from the Institute of Inspection, Cleaning and Restoration Certification (IICRC). ${IICRC_DESCRIPTIONS[code] || ''}`,
          sourceType: 'industry',
          sourceName: 'IICRC — Institute of Inspection, Cleaning and Restoration Certification',
          confidence: 0.85,
        });
      }
    }

    // Check NCC/BCA references
    for (const [code, url] of Object.entries(NCC_REFERENCES)) {
      if (upperQuery.includes('NCC') || upperQuery.includes('BCA') || upperQuery.includes('BUILDING CODE')) {
        // Avoid duplicate entries (NCC and BCA point to same URL)
        const alreadyAdded = results.some((r) => r.url === url);
        if (!alreadyAdded) {
          results.push({
            title: NCC_DESCRIPTIONS[code] || `${code} — National Construction Standard`,
            url,
            snippet: `Australian Building Codes Board (ABCB). ${NCC_DESCRIPTIONS[code] || ''}`,
            sourceType: 'industry',
            sourceName: 'Australian Building Codes Board (ABCB)',
            confidence: 0.85,
          });
        }
        break;
      }
    }

    return results;
  }

  private async searchAsic(query: string): Promise<SourceResult[]> {
    try {
      const url = `https://abr.business.gov.au/abrxmlsearch/AbrXmlSearch.asmx/SearchByName?name=${encodeURIComponent(query)}&maxResults=5`;

      const response = await fetch(url, {
        headers: {
          Accept: 'application/xml, text/xml',
        },
      });

      if (!response.ok) {
        return [];
      }

      const xml = await response.text();

      // Parse ABN search XML response — extract business names and ABNs
      const results: SourceResult[] = [];
      const entityMatches = xml.matchAll(/<entityName>([^<]+)<\/entityName>/g);
      const abnMatches = [...xml.matchAll(/<abn>([^<]+)<\/abn>/g)];

      let index = 0;
      for (const match of entityMatches) {
        const name = match[1]?.trim();
        const abn = abnMatches[index]?.[1]?.trim();
        if (name) {
          results.push({
            title: name,
            url: abn
              ? `https://abr.business.gov.au/ABN/View?abn=${abn.replace(/\s/g, '')}`
              : 'https://abr.business.gov.au/',
            snippet: abn
              ? `Australian registered business: ${name} (ABN: ${abn})`
              : `Australian registered business: ${name}`,
            sourceType: 'industry',
            sourceName: 'Australian Business Register (ASIC/ABR)',
            confidence: 0.85,
          });
        }
        index++;
      }

      return results;
    } catch {
      // ASIC lookup is optional — silently fail
      return [];
    }
  }

  async search(query: string): Promise<SourceResult[]> {
    try {
      const staticResults = this.matchStaticReferences(query);
      const asicResults = await this.searchAsic(query);

      return [...staticResults, ...asicResults];
    } catch (error) {
      logger.warn('Industry Registry connector error', {
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      // Return static results even if dynamic lookup fails
      return this.matchStaticReferences(query);
    }
  }
}
