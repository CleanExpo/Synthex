/**
 * Google Ads read-only integration service.
 * Fetches campaign-level performance snapshots via the Google Ads API v17.
 * Uses fetch() directly — no SDK dependency.
 */

const GOOGLE_ADS_API_BASE = 'https://googleads.googleapis.com/v17';

export interface GoogleAdsCampaignMetrics {
  campaignId: string;
  campaignName: string;
  impressions: number;
  clicks: number;
  costMicros: number;
  conversions: number;
  conversionValue: number;
}

export interface GoogleAdsAccount {
  customerId: string;
  name: string;
  currencyCode: string;
  timeZone: string;
}

export class GoogleAdsService {
  private accessToken: string;
  private customerId: string;

  constructor(accessToken: string, customerId: string) {
    this.accessToken = accessToken;
    this.customerId = customerId.replace(/-/g, '');
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '',
      'Content-Type': 'application/json',
    };
  }

  async getAccountInfo(): Promise<GoogleAdsAccount> {
    const query = `
      SELECT
        customer.id,
        customer.descriptive_name,
        customer.currency_code,
        customer.time_zone
      FROM customer
      LIMIT 1
    `;
    const res = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${this.customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ query }),
      }
    );
    if (!res.ok) {
      throw new Error(`Google Ads API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as Array<{ results: Array<{ customer: { id: string; descriptiveName: string; currencyCode: string; timeZone: string } }> }>;
    const customer = data[0]?.results?.[0]?.customer;
    if (!customer) throw new Error('No customer data returned from Google Ads');
    return {
      customerId: customer.id,
      name: customer.descriptiveName,
      currencyCode: customer.currencyCode,
      timeZone: customer.timeZone,
    };
  }

  async getCampaignMetrics(
    dateStart: string,
    dateEnd: string
  ): Promise<GoogleAdsCampaignMetrics[]> {
    const query = `
      SELECT
        campaign.id,
        campaign.name,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${dateStart}' AND '${dateEnd}'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
      LIMIT 100
    `;
    const res = await fetch(
      `${GOOGLE_ADS_API_BASE}/customers/${this.customerId}/googleAds:searchStream`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ query }),
      }
    );
    if (!res.ok) {
      throw new Error(`Google Ads API error ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as Array<{
      results: Array<{
        campaign: { id: string; name: string };
        metrics: {
          impressions: string;
          clicks: string;
          costMicros: string;
          conversions: string;
          conversionsValue: string;
        };
      }>;
    }>;
    return (data[0]?.results ?? []).map((r) => ({
      campaignId: r.campaign.id,
      campaignName: r.campaign.name,
      impressions: Number(r.metrics.impressions),
      clicks: Number(r.metrics.clicks),
      costMicros: Number(r.metrics.costMicros),
      conversions: Number(r.metrics.conversions),
      conversionValue: Number(r.metrics.conversionsValue),
    }));
  }
}
