/**
 * SYN-1217 — switching organisation must never paint the previous
 * organisation's hide choice, not even for one render.
 *
 * Testing Library flushes effects inside act(), so the in-between render is
 * invisible to DOM queries. The panel wrapper is mocked to record every render
 * with the organisation it was rendered for.
 */

import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SampleCampaignPanel } from '@/components/dashboard/SampleCampaignPanel';
import { sampleCampaignDismissKey } from '@/lib/onboarding/sample-campaign';

const painted: string[] = [];
let currentOrg = '';

jest.mock('@/components/dashboard/DashboardAtmosphere', () => ({
  DashboardPanel: ({ children }: { children: ReactNode }) => {
    painted.push(currentOrg);
    return <div>{children}</div>;
  },
}));

function Probe({ org }: { org: string }) {
  return (
    <SampleCampaignPanel
      organizationId={org}
      totalPosts={0}
      scheduledPosts={0}
    />
  );
}

describe('SampleCampaignPanel organisation switch', () => {
  beforeEach(() => {
    window.localStorage.clear();
    painted.length = 0;
  });

  it('never paints the sample for an organisation that hid it', async () => {
    window.localStorage.setItem(sampleCampaignDismissKey('org-1'), 'true');

    currentOrg = 'org-2';
    const { rerender } = render(<Probe org="org-2" />);
    await act(async () => {});
    expect(painted).toContain('org-2'); // org-2 never hid it

    currentOrg = 'org-1';
    rerender(<Probe org="org-1" />);
    await act(async () => {});
    expect(painted).not.toContain('org-1');
  });
});
