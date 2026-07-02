/**
 * MultiFormatPage — content-extraction regression test.
 *
 * Guards the fix for the `[object Object]` bug: `/api/content/generate` returns
 * `content: { primary, variations, metadata }` (an OBJECT), so the page must
 * extract `content.primary` rather than rendering the whole object. Also asserts
 * the legacy flat-string `{ content }` shape still renders.
 *
 * Verifies, for a single selected platform:
 *   - object shape `{ content: { primary: 'X', ... } }` renders the post text `X`
 *     (NOT `[object Object]`) in the card
 *   - the CopyButton copies the STRING `X` (not an object) to the clipboard
 *   - legacy string shape `{ content: 'Y' }` still renders `Y`
 */

import React from 'react';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import MultiFormatPage from '@/app/dashboard/content/multi-format/page';

// Select only Twitter/X so a single result card is asserted unambiguously.
async function generateForTwitterOnly() {
  // Deselect every platform except Twitter / X.
  const labels = [
    'LinkedIn',
    'Instagram',
    'TikTok',
    'Facebook',
    'YouTube',
    'Pinterest',
    'Reddit',
    'Threads',
  ];
  for (const label of labels) {
    fireEvent.click(screen.getByText(label));
  }

  fireEvent.change(screen.getByLabelText('Topic'), {
    target: { value: 'productivity habits' },
  });

  fireEvent.click(screen.getByRole('button', { name: /generate content/i }));
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  // @ts-expect-error cleanup test double
  delete global.fetch;
});

describe('MultiFormatPage content extraction', () => {
  it('renders content.primary (the route object shape), not [object Object]', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        // Real `/api/content/generate` POST shape (route.ts lines 174-179).
        content: {
          primary: 'Ship one habit at a time.',
          variations: ['alt a', 'alt b'],
          metadata: { tone: 'casual' },
        },
      }),
    }) as unknown as typeof fetch;

    render(<MultiFormatPage />);
    await generateForTwitterOnly();

    await waitFor(() =>
      expect(screen.getByText('Ship one habit at a time.')).toBeInTheDocument()
    );
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });

  it('copies the extracted STRING to the clipboard, not an object', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        content: {
          primary: 'Copy me as a string.',
          variations: [],
          metadata: {},
        },
      }),
    }) as unknown as typeof fetch;

    render(<MultiFormatPage />);
    await generateForTwitterOnly();

    const copyButton = await screen.findByRole('button', {
      name: /copy content/i,
    });
    fireEvent.click(copyButton);

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith('Copy me as a string.');
  });

  it('still renders the legacy flat-string { content } shape', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        content: 'Legacy string body.',
      }),
    }) as unknown as typeof fetch;

    render(<MultiFormatPage />);
    await generateForTwitterOnly();

    await waitFor(() =>
      expect(screen.getByText('Legacy string body.')).toBeInTheDocument()
    );
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
  });
});
