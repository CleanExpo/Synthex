import { render, screen } from '@testing-library/react';
import useSWR from 'swr';
import { ProviderReadinessStrip } from '@/components/command-centre';

jest.mock('swr');

const mockUseSWR = useSWR as jest.MockedFunction<typeof useSWR>;

describe('ProviderReadinessStrip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders provider modes without credential values', () => {
    mockUseSWR.mockReturnValue({
      data: {
        organizationId: 'org-1',
        providers: [
          { provider: 'telegram', mode: 'blocked', reason: 'missing' },
          { provider: 'pipedream', mode: 'draft', reason: 'draft only' },
          { provider: 'apify', mode: 'live', reason: 'present' },
        ],
      },
      isLoading: false,
    } as ReturnType<typeof useSWR>);

    render(<ProviderReadinessStrip />);

    expect(screen.getByText('Provider Gates')).toBeInTheDocument();
    expect(screen.getByText('telegram')).toBeInTheDocument();
    expect(screen.getByText('pipedream')).toBeInTheDocument();
    expect(screen.getByText('apify')).toBeInTheDocument();
    expect(screen.queryByText(/sk-/i)).not.toBeInTheDocument();
  });
});
