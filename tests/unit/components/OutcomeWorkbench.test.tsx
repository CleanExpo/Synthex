import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OutcomeWorkbench } from '@/components/marketing-agency/OutcomeWorkbench';

type FetchMock = jest.Mock<Promise<Partial<Response>>, [string, RequestInit?]>;

function jsonResponse(body: unknown, ok = true, status = 200): Partial<Response> {
  return { ok, status, json: async () => body };
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

describe('OutcomeWorkbench', () => {
  it('reuses an existing active agent for a preset outcome and shows one next action', async () => {
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (url === '/api/marketing-agency/agents' && (!init || init.method !== 'POST')) {
        return Promise.resolve(
          jsonResponse({
            agents: [
              {
                id: 'agent-1',
                name: 'Launch RestoreAssist',
                goal: 'whatever',
                status: 'active',
              },
            ],
          })
        );
      }
      if (url === '/api/marketing-agency/agents/agent-1/run') {
        return Promise.resolve(jsonResponse({ run: { id: 'run-9' } }, true, 202));
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<OutcomeWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Launch RestoreAssist' }));

    const cta = await screen.findByRole('link', { name: /review prepared work/i });
    expect(cta).toHaveAttribute(
      'href',
      '/dashboard/marketing-agency/runs/run-9'
    );

    // It must NOT create a new agent when an active match exists.
    const postCreate = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/marketing-agency/agents' && init?.method === 'POST'
    );
    expect(postCreate).toBeUndefined();
  });

  it('creates an agent draft then runs it when no agent matches', async () => {
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (url === '/api/marketing-agency/agents' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ agent: { id: 'agent-new' } }, true, 201));
      }
      if (url === '/api/marketing-agency/agents') {
        return Promise.resolve(jsonResponse({ agents: [] }));
      }
      if (url === '/api/marketing-agency/agents/agent-new/run') {
        return Promise.resolve(jsonResponse({ run: { id: 'run-new' } }, true, 202));
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<OutcomeWorkbench />);
    fireEvent.change(screen.getByLabelText('Business outcome'), {
      target: { value: 'Win more enquiries' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Prepare work' }));

    const cta = await screen.findByRole('link', { name: /review prepared work/i });
    expect(cta).toHaveAttribute(
      'href',
      '/dashboard/marketing-agency/runs/run-new'
    );

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/marketing-agency/agents' && init?.method === 'POST'
    );
    expect(createCall).toBeDefined();
    const sentBody = JSON.parse((createCall![1]!.body as string) as string);
    expect(sentBody.name).toBe('Win more enquiries');
    expect(sentBody.goal).toContain('Win more enquiries');
  });

  it('surfaces the tier gate without running when agent creation is blocked (402)', async () => {
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (url === '/api/marketing-agency/agents' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse({ error: 'Agent limit reached for your plan' }, false, 402)
        );
      }
      if (url === '/api/marketing-agency/agents') {
        return Promise.resolve(jsonResponse({ agents: [] }));
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<OutcomeWorkbench />);
    fireEvent.click(screen.getByRole('button', { name: 'Build CARSI authority' }));

    expect(
      await screen.findByText(/agent limit reached for your plan/i)
    ).toBeInTheDocument();

    // No run was attempted — the gate was not bypassed.
    const runCall = fetchMock.mock.calls.find(([url]) =>
      url.includes('/run')
    );
    expect(runCall).toBeUndefined();
    expect(
      screen.queryByRole('link', { name: /review prepared work/i })
    ).not.toBeInTheDocument();
  });
});
