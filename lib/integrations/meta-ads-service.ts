/**
 * Meta Ads (Facebook/Instagram) read-only integration service.
 * Fetches ad account and campaign-level insights via the Meta Graph API v18.
 * Uses fetch() directly — no SDK dependency.
 */

const META_GRAPH_BASE = 'https://graph.facebook.com/v18.0';

export interface MetaAdsCampaignMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversionValue: number;
}

export interface MetaAdsAccount {
  accountId: string;
  name: string;
  currencyCode: string;
  timeZone: string;
}

export class MetaAdsService {
  private accessToken: string;
  private adAccountId: string;

  constructor(accessToken: string, adAccountId: string) {
    this.accessToken = accessToken;
    this.adAccountId = adAccountId.startsWith('act_')
      ? adAccountId
      : `act_${adAccountId}`;
  }

  async getAccountInfo(): Promise<MetaAdsAccount> {
    const params = new URLSearchParams({
      fields: 'id,name,currency,timezone_name',
      access_token: this.accessToken,
    });
    const res = await fetch(
      `${META_GRAPH_BASE}/${this.adAccountId}?${params}`
    );
    if (!res.ok) {
      throw new Error(`Meta Ads API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      id: string;
      name: string;
      currency: string;
      timezone_name: string;
    };
    return {
      accountId: data.id,
      name: data.name,
      currencyCode: data.currency,
      timeZone: data.timezone_name,
    };
  }

  async getCampaignInsights(
    dateStart: string,
    dateEnd: string
  ): Promise<MetaAdsCampaignMetrics[]> {
    const params = new URLSearchParams({
      fields:
        'campaign_id,campaign_name,impressions,clicks,spend,actions,action_values',
      level: 'campaign',
      time_range: JSON.stringify({ since: dateStart, until: dateEnd }),
      limit: '100',
      access_token: this.accessToken,
    });
    const res = await fetch(
      `${META_GRAPH_BASE}/${this.adAccountId}/insights?${params}`
    );
    if (!res.ok) {
      throw new Error(`Meta Ads API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as {
      data: Array<{
        campaign_id: string;
        campaign_name: string;
        impressions: string;
        clicks: string;
        spend: string;
        actions?: Array<{ action_type: string; value: string }>;
        action_values?: Array<{ action_type: string; value: string }>;
      }>;
    };

    return (data.data ?? []).map((r) => {
      const purchases =
        r.actions?.find((a) => a.action_type === 'purchase')?.value ?? '0';
      const purchaseValue =
        r.action_values?.find((a) => a.action_type === 'purchase')?.value ??
        '0';
      return {
        campaignId: r.campaign_id,
        campaignName: r.campaign_name,
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        spend: Number(r.spend),
        conversions: Number(purchases),
        conversionValue: Number(purchaseValue),
      };
    });
  }
}
