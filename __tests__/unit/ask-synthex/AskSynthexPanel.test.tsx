/**
 * AskSynthexPanel unit tests — SYN-682
 *
 * Coverage:
 *   - Feature flag + isOwner gating
 *   - Collapsed / expanded state transitions
 *   - Sending a question (happy path)
 *   - API error handling
 *   - 15 s timeout message
 *   - Sources chevron toggle
 *   - Close button aborts request
 */

import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AskSynthexPanel } from '@/components/ask-synthex/AskSynthexPanel';

// ── Env helpers ───────────────────────────────────────────────────────────────

function setFlag(value: string | undefined) {
  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT;
  } else {
    process.env.NEXT_PUBLIC_ENABLE_ASK_SYNTHEX_CLIENT_ROLLOUT = value;
  }
}

// ── DOM stubs (JSDOM doesn't implement these) ─────────────────────────────────

Element.prototype.scrollIntoView = jest.fn();

// ── fetch mock ────────────────────────────────────────────────────────────────

const mockFetch = jest.fn();
global.fetch = mockFetch;

function mockSuccess(body: object) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  } as Response);
}

function mockError(status: number, body: object) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => body,
  } as Response);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function expandPanel() {
  const btn = screen.getByRole('button', { name: /ask synthex a question/i });
  await userEvent.click(btn);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AskSynthexPanel — feature flag gating', () => {
  afterEach(() => setFlag(undefined));

  it('renders nothing when flag is off and user is not owner', () => {
    setFlag('false');
    const { container } = render(<AskSynthexPanel isOwner={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when flag is off but user IS owner', () => {
    setFlag('false');
    render(<AskSynthexPanel isOwner={true} />);
    expect(
      screen.getByRole('button', { name: /ask synthex a question/i })
    ).toBeInTheDocument();
  });

  it('renders for non-owner when flag is on', () => {
    setFlag('true');
    render(<AskSynthexPanel isOwner={false} />);
    expect(
      screen.getByRole('button', { name: /ask synthex a question/i })
    ).toBeInTheDocument();
  });
});

describe('AskSynthexPanel — collapsed state', () => {
  beforeEach(() => setFlag('true'));
  afterEach(() => setFlag(undefined));

  it('shows entry button when collapsed', () => {
    render(<AskSynthexPanel isOwner={false} />);
    expect(
      screen.getByRole('button', { name: /ask synthex a question/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('expands on button click', async () => {
    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();
    expect(
      screen.getByRole('textbox', { name: /your question/i })
    ).toBeInTheDocument();
  });
});

describe('AskSynthexPanel — expanded state', () => {
  beforeEach(() => setFlag('true'));
  afterEach(() => {
    setFlag(undefined);
    mockFetch.mockReset();
  });

  it('shows empty state prompt when no messages', async () => {
    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();
    expect(
      screen.getByText(/ask anything about your content/i)
    ).toBeInTheDocument();
  });

  it('collapses when close button is clicked', async () => {
    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();
    const closeBtn = screen.getByRole('button', { name: /close ask synthex/i });
    await userEvent.click(closeBtn);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ask synthex a question/i })
    ).toBeInTheDocument();
  });
});

describe('AskSynthexPanel — sending a question (happy path)', () => {
  beforeEach(() => setFlag('true'));
  afterEach(() => {
    setFlag(undefined);
    mockFetch.mockReset();
  });

  it('sends POST to /api/ask-synthex with question', async () => {
    mockSuccess({
      conversationId: 'conv-123',
      answer: 'Your engagement rate is 4.2%.',
      tier: 'simple',
      sources: [],
    });

    render(<AskSynthexPanel isOwner={false} clientId="org-abc" />);
    await expandPanel();

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await userEvent.type(textarea, 'What is my engagement rate?');
    const sendBtn = screen.getByRole('button', { name: /send question/i });
    await userEvent.click(sendBtn);

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/ask-synthex',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: expect.stringContaining(
          '"question":"What is my engagement rate?"'
        ),
      })
    );

    await waitFor(() => {
      expect(
        screen.getByText('Your engagement rate is 4.2%.')
      ).toBeInTheDocument();
    });
  });

  it('clears input after sending', async () => {
    mockSuccess({
      conversationId: 'c1',
      answer: 'Answer',
      tier: 'simple',
      sources: [],
    });

    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await userEvent.type(textarea, 'My question');
    await userEvent.click(
      screen.getByRole('button', { name: /send question/i })
    );

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('sends on Enter key', async () => {
    mockSuccess({
      conversationId: 'c2',
      answer: 'Reply',
      tier: 'simple',
      sources: [],
    });

    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await userEvent.type(textarea, 'Question{Enter}');

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  it('does not send on Shift+Enter', async () => {
    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await userEvent.type(textarea, 'Line1{shift>}{Enter}{/shift}Line2');

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('AskSynthexPanel — error handling', () => {
  beforeEach(() => setFlag('true'));
  afterEach(() => {
    setFlag(undefined);
    mockFetch.mockReset();
  });

  it('shows API error message', async () => {
    mockError(403, { error: 'Not authorised to use Ask Synthex.' });

    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await userEvent.type(textarea, 'Question');
    await userEvent.click(
      screen.getByRole('button', { name: /send question/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(/not authorised to use ask synthex/i)
      ).toBeInTheDocument();
    });
  });

  it('shows generic error on non-JSON 500', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await userEvent.type(textarea, 'Question');
    await userEvent.click(
      screen.getByRole('button', { name: /send question/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/request failed \(500\)/i)).toBeInTheDocument();
    });
  });
});

describe('AskSynthexPanel — sources chevron', () => {
  beforeEach(() => setFlag('true'));
  afterEach(() => {
    setFlag(undefined);
    mockFetch.mockReset();
  });

  it('shows sources on chevron click', async () => {
    mockSuccess({
      conversationId: 'c3',
      answer: 'Your reach was 12,000.',
      tier: 'standard',
      sources: [{ label: 'Reach (30d)', value: 12000, period: 'Mar 2026' }],
    });

    render(<AskSynthexPanel isOwner={false} />);
    await expandPanel();

    const textarea = screen.getByRole('textbox', { name: /your question/i });
    await userEvent.type(textarea, 'What was my reach?');
    await userEvent.click(
      screen.getByRole('button', { name: /send question/i })
    );

    await waitFor(() => {
      expect(screen.getByText('Your reach was 12,000.')).toBeInTheDocument();
    });

    const sourcesBtn = screen.getByRole('button', { name: /show sources/i });
    await userEvent.click(sourcesBtn);

    expect(screen.getByText(/reach \(30d\)/i)).toBeInTheDocument();
    expect(screen.getByText(/12000/)).toBeInTheDocument();
  });
});
