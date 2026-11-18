/**
 * SYN-1217 — built-in sample campaign so first value needs no OAuth.
 *
 * Proves: the data is invented and labelled on every item; the module cannot
 * reach the database, network or publish code; the Home panel shows only while
 * the workspace has no posts; the operator can hide it and it stays hidden.
 */

import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  SAMPLE_CAMPAIGN,
  sampleCampaignDismissKey,
  shouldShowSampleCampaign,
} from '@/lib/onboarding/sample-campaign';
import { SampleCampaignPanel } from '@/components/dashboard/SampleCampaignPanel';

describe('SAMPLE_CAMPAIGN data', () => {
  it('labels the campaign and every post as a sample', () => {
    expect(SAMPLE_CAMPAIGN.isSample).toBe(true);
    expect(SAMPLE_CAMPAIGN.name.startsWith('Sample')).toBe(true);
    expect(SAMPLE_CAMPAIGN.businessName).toMatch(/made-up/i);
    expect(SAMPLE_CAMPAIGN.posts.length).toBeGreaterThanOrEqual(3);
    for (const p of SAMPLE_CAMPAIGN.posts) {
      expect(p.isSample).toBe(true);
      expect(p.title.startsWith('Sample: ')).toBe(true);
      expect(p.id.startsWith('sample-')).toBe(true);
    }
  });

  it('contains no handles, links or emails that could point at a real account', () => {
    const text = JSON.stringify(SAMPLE_CAMPAIGN);
    expect(text).not.toMatch(/@|https?:\/\/|www\./i);
  });

  it('is frozen so nothing can turn a sample into a real post at runtime', () => {
    expect(Object.isFrozen(SAMPLE_CAMPAIGN)).toBe(true);
    expect(Object.isFrozen(SAMPLE_CAMPAIGN.posts)).toBe(true);
    expect(Object.isFrozen(SAMPLE_CAMPAIGN.posts[0])).toBe(true);
  });

  it('imports nothing, so it has no route to the database, network or publish queue', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'lib/onboarding/sample-campaign.ts'),
      'utf8'
    );
    expect(src).not.toMatch(/^\s*import\s/m);
    expect(src).not.toMatch(/require\(|fetch\(|prisma|publish-queue/i);
  });
});

describe('shouldShowSampleCampaign', () => {
  it('shows only for an empty workspace that has not hidden it', () => {
    expect(
      shouldShowSampleCampaign({
        totalPosts: 0,
        scheduledPosts: 0,
        dismissed: false,
      })
    ).toBe(true);
    expect(
      shouldShowSampleCampaign({
        totalPosts: 1,
        scheduledPosts: 0,
        dismissed: false,
      })
    ).toBe(false);
    expect(
      shouldShowSampleCampaign({
        totalPosts: 0,
        scheduledPosts: 2,
        dismissed: false,
      })
    ).toBe(false);
    expect(
      shouldShowSampleCampaign({
        totalPosts: 0,
        scheduledPosts: 0,
        dismissed: true,
      })
    ).toBe(false);
  });

  it('keeps the hide choice separate per organisation', () => {
    expect(sampleCampaignDismissKey('org-a')).not.toBe(
      sampleCampaignDismissKey('org-b')
    );
  });
});

describe('SampleCampaignPanel', () => {
  beforeEach(() => window.localStorage.clear());

  async function renderPanel(totalPosts = 0, scheduledPosts = 0) {
    const utils = render(
      <SampleCampaignPanel
        organizationId="org-1"
        totalPosts={totalPosts}
        scheduledPosts={scheduledPosts}
      />
    );
    await act(async () => {});
    return utils;
  }

  it('shows the labelled sample for a new workspace with no connection', async () => {
    await renderPanel();
    expect(
      screen.getByText('Sample only, not posted anywhere')
    ).toBeInTheDocument();
    expect(screen.getByText(SAMPLE_CAMPAIGN.name)).toBeInTheDocument();
    for (const p of SAMPLE_CAMPAIGN.posts) {
      expect(screen.getByText(p.title)).toBeInTheDocument();
    }
  });

  it('offers no schedule, publish or post action on sample content', async () => {
    await renderPanel();
    const buttons = screen.getAllByRole('button').map(b => b.textContent);
    expect(buttons).toEqual(['Hide sample']);
    const links = screen.getAllByRole('link');
    expect(links.map(l => l.getAttribute('href'))).toEqual([
      '/dashboard/content',
    ]);
    expect(links[0]).toHaveTextContent('Write your own first post');
  });

  it('disappears once the workspace has a real post', async () => {
    await renderPanel(1, 0);
    expect(screen.queryByText('Sample only, not posted anywhere')).toBeNull();
  });

  it('can be hidden by the operator and stays hidden on the next visit', async () => {
    const first = await renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Hide sample' }));
    expect(screen.queryByText('Sample only, not posted anywhere')).toBeNull();
    expect(window.localStorage.getItem(sampleCampaignDismissKey('org-1'))).toBe(
      'true'
    );
    first.unmount();

    await renderPanel();
    expect(screen.queryByText('Sample only, not posted anywhere')).toBeNull();
  });
});
