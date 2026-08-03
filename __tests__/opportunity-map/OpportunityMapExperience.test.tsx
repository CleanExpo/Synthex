import { fireEvent, render, screen } from '@testing-library/react';
import { OpportunityMapExperience } from '@/components/opportunity-map/OpportunityMapExperience';
import type { OpportunityMap } from '@/lib/opportunity-map';

const map: OpportunityMap = {
  version: '1.0',
  generatedAt: '2026-08-03T02:00:00.000Z',
  brandContext: {
    businessName: 'Acme Restoration',
    website: 'https://acme.example.com',
    industry: 'agency',
    description: 'Commercial restoration planning and response services.',
    audience: 'Facilities and property managers',
    tone: 'professional',
    topics: ['restoration planning'],
    confidence: 84,
  },
  evidence: [
    {
      id: 'source-1',
      kind: 'website',
      label: 'Primary website',
      value: 'https://acme.example.com',
      state: 'provided',
    },
  ],
  signals: [{ label: 'Search foundation', value: '48/100', state: 'observed' }],
  gaps: [],
  opportunities: [
    {
      id: 'search-demand',
      rank: 1,
      title: 'Capture existing search demand',
      direction: 'Build one evidence-led search cluster.',
      whyNow: 'The search foundation has room to improve.',
      score: 82,
      value: 'high',
      effort: 'medium',
      evidence: ['Observed SEO foundation: 48/100'],
      assumptions: ['Keyword difficulty still requires research.'],
      outcome: 'More qualified discovery traffic.',
    },
    {
      id: 'offer-clarity',
      rank: 2,
      title: 'Make the buying path unmistakable',
      direction: 'Clarify one audience-specific service path.',
      whyNow: 'The offer needs a clearer path.',
      score: 74,
      value: 'high',
      effort: 'low',
      evidence: ['A service description was observed.'],
      assumptions: ['Conversion data may change the recommendation.'],
      outcome: 'More qualified enquiries.',
    },
    {
      id: 'authority-system',
      rank: 3,
      title: 'Turn expertise into an authority system',
      direction: 'Create an evidence-backed answer library.',
      whyNow: 'Useful expertise is not yet visible.',
      score: 68,
      value: 'high',
      effort: 'medium',
      evidence: ['Limited topic depth was observed.'],
      assumptions: ['Subject-matter evidence must be supplied.'],
      outcome: 'Compounding authority content.',
    },
  ],
  fit: {
    score: 72,
    state: 'qualified',
    explanation: 'Enough context exists to shape a service recommendation.',
  },
  recommendedNextMove: 'Build one evidence-led search cluster.',
  serviceRecommendation: {
    title: 'Shape an owned-channel growth sprint',
    summary: 'Use search demand as the first commercial workstream.',
    included: ['Evidence research'],
    boundaries: [
      'No public publishing or paid spend is authorized by this map.',
    ],
  },
};

describe('OpportunityMapExperience', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reveals the ranked map before asking for contact consent', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ scanId: 'scan_123456789', map }),
    } as Response);

    render(<OpportunityMapExperience />);

    expect(screen.queryByLabelText(/work email/i)).not.toBeInTheDocument();
    fireEvent.change(
      screen.getByRole('textbox', {
        name: /website, social links and rough context/i,
      }),
      { target: { value: 'https://acme.example.com' } }
    );
    fireEvent.click(screen.getByRole('button', { name: /build my free map/i }));

    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'Acme Restoration',
      })
    ).toBeVisible();
    expect(
      screen.getByText('Capture existing search demand')
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not subscribe me to general marketing/i)
    ).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/opportunity-map',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
