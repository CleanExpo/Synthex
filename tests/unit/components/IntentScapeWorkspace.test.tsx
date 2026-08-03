import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IntentScapeWorkspace } from '@/components/intentscape/IntentScapeWorkspace';
import type { IntentScapeWorkspaceSnapshot } from '@/components/intentscape/types';

type FetchMock = jest.Mock<Promise<Partial<Response>>, [string, RequestInit?]>;

function jsonResponse(
  body: unknown,
  ok = true,
  status = 200
): Partial<Response> {
  return { ok, status, json: async () => body };
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function contextSnapshot(): IntentScapeWorkspaceSnapshot {
  return {
    workspace: {
      id: 'workspace-1',
      organizationId: 'org-1',
      title: 'Reframe product imagery',
      state: 'context_ready',
      activeContextVersion: 1,
      retentionClass: 'standard',
      createdById: 'user-1',
      createdAt: '2026-08-03T00:00:00.000Z',
      updatedAt: '2026-08-03T00:00:00.000Z',
    },
    contextField: {
      workspaceId: 'workspace-1',
      organizationId: 'org-1',
      version: 1,
      originSignal: 'Build a tool that creates better product images.',
      signals: [
        {
          id: 'signal-1',
          kind: 'origin-signal',
          label: 'Initial human signal',
          content: 'Build a tool that creates better product images.',
          evidenceState: 'opinion',
          capturedAt: '2026-08-03T00:00:00.000Z',
          provenance: 'Authenticated human intake',
        },
      ],
      contradictions: [],
      unknowns: ['The highest-value intervention is not established.'],
      createdAt: '2026-08-03T00:00:00.000Z',
    },
    acceptedVision: null,
    goalContract: null,
    runs: [],
    artifacts: [
      {
        id: 'artifact-1',
        kind: 'context-field',
        logicalPath: 'context/field.md',
        version: 1,
        evidenceState: 'unverified',
        contentHash: 'hash-1',
        createdAt: '2026-08-03T00:00:00.000Z',
      },
    ],
    events: [],
  };
}

describe('IntentScapeWorkspace', () => {
  it('opens with a clear non-chatbot explanation when no workspace exists', async () => {
    const fetchMock: FetchMock = jest.fn(() =>
      Promise.resolve(jsonResponse({ workspaces: [] }))
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<IntentScapeWorkspace />);

    expect(
      await screen.findByRole('heading', {
        name: /give intentscape the spark, not a perfectly written prompt/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /not treated as the end goal, search query, tool instruction/i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/capture in one pass/i)).toBeInTheDocument();
  });

  it('creates a Context Field and exposes expansion without converting the signal into a goal', async () => {
    const snapshot = contextSnapshot();
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (url === '/api/intentscape/workspaces' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            {
              workspace: {
                id: 'workspace-1',
                organizationId: 'org-1',
                title: snapshot.workspace.title,
                state: 'context_ready',
                contextField: snapshot.contextField,
              },
            },
            true,
            201
          )
        );
      }
      if (url === '/api/intentscape/workspaces/workspace-1') {
        return Promise.resolve(jsonResponse({ snapshot }));
      }
      if (url === '/api/intentscape/workspaces') {
        const list =
          fetchMock.mock.calls.length === 1 ? [] : [snapshot.workspace];
        return Promise.resolve(jsonResponse({ workspaces: list }));
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<IntentScapeWorkspace />);
    fireEvent.change(await screen.findByLabelText(/what is on your mind/i), {
      target: { value: snapshot.contextField!.originSignal },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /create the context field/i })
    );

    expect(
      await screen.findByRole('button', { name: /expand beyond the brief/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/provenance only/i)).toBeInTheDocument();
    expect(screen.getByText(/decision dock locked/i)).toBeInTheDocument();

    const createCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        url === '/api/intentscape/workspaces' && init?.method === 'POST'
    );
    expect(JSON.parse(createCall![1]!.body as string)).toEqual({
      title: 'Build a tool that creates better product images',
      originSignal: snapshot.contextField!.originSignal,
    });
  });

  it('submits company, social, document and note context as one evidence batch', async () => {
    const snapshot = contextSnapshot();
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (
        url === '/api/intentscape/workspaces/workspace-1/signals' &&
        init?.method === 'POST'
      ) {
        return Promise.resolve(
          jsonResponse({ contextField: snapshot.contextField })
        );
      }
      if (url === '/api/intentscape/workspaces/workspace-1') {
        return Promise.resolve(jsonResponse({ snapshot }));
      }
      if (url === '/api/intentscape/workspaces') {
        return Promise.resolve(
          jsonResponse({ workspaces: [snapshot.workspace] })
        );
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<IntentScapeWorkspace />);
    expect(
      await screen.findByText(/paste everything you already know once/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sort manually/i }));
    fireEvent.change(screen.getByLabelText(/company \+ product urls/i), {
      target: { value: 'example.com' },
    });
    fireEvent.change(screen.getByLabelText(/social pages/i), {
      target: { value: 'https://instagram.com/example' },
    });
    fireEvent.change(screen.getByLabelText(/docs \+ references/i), {
      target: { value: 'https://docs.example.com' },
    });
    fireEvent.change(screen.getByLabelText(/context notes/i), {
      target: { value: 'Customers need to compare variations quickly.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /add the full batch/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/context field updated/i)).toBeInTheDocument();
    });
    const signalCall = fetchMock.mock.calls.find(([url]) =>
      url.endsWith('/signals')
    );
    const payload = JSON.parse(signalCall![1]!.body as string) as {
      expectedContextVersion: number;
      signals: Array<{ kind: string; sourceUrl?: string; content: string }>;
    };
    expect(payload.expectedContextVersion).toBe(1);
    expect(payload.signals.map(signal => signal.kind)).toEqual([
      'website',
      'social-page',
      'document',
      'note',
    ]);
    expect(payload.signals[0]?.sourceUrl).toBe('https://example.com/');
  });

  it('classifies a one-paste context dump without making the user sort it first', async () => {
    const snapshot = contextSnapshot();
    const fetchMock: FetchMock = jest.fn((url, init) => {
      if (
        url === '/api/intentscape/workspaces/workspace-1/signals' &&
        init?.method === 'POST'
      ) {
        return Promise.resolve(
          jsonResponse({ contextField: snapshot.contextField })
        );
      }
      if (url === '/api/intentscape/workspaces/workspace-1') {
        return Promise.resolve(jsonResponse({ snapshot }));
      }
      if (url === '/api/intentscape/workspaces') {
        return Promise.resolve(
          jsonResponse({ workspaces: [snapshot.workspace] })
        );
      }
      throw new Error(`unexpected fetch ${url} ${init?.method ?? 'GET'}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    render(<IntentScapeWorkspace />);
    fireEvent.change(
      await screen.findByLabelText(/paste everything you have/i),
      {
        target: {
          value: [
            'https://example.com',
            'https://github.com/example/product',
            'Customers cannot compare the options quickly.',
          ].join('\n'),
        },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: /add everything/i }));

    await waitFor(() => {
      expect(screen.getByText(/context field updated/i)).toBeInTheDocument();
    });
    const signalCall = fetchMock.mock.calls.find(([url]) =>
      url.endsWith('/signals')
    );
    const payload = JSON.parse(signalCall![1]!.body as string) as {
      signals: Array<{ kind: string }>;
    };
    expect(payload.signals.map(signal => signal.kind)).toEqual([
      'website',
      'document',
      'note',
    ]);
  });
});
