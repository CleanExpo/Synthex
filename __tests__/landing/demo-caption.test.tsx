/**
 * /demo promised "generate a caption — no signup" in its metadata but rendered
 * an "Animation Gallery" whose cards linked to four /demo/* routes that 404.
 * It now posts to the public, rate-limited POST /api/demo/caption.
 */

import { readFileSync } from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import { CaptionDemo } from '@/components/demo/CaptionDemo';

function respond(status: number, body: unknown) {
  return jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

function submit(name: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /business name/i }), {
    target: { value: name },
  });
  fireEvent.click(screen.getByRole('button', { name: /generate caption/i }));
}

describe('CaptionDemo', () => {
  afterEach(() => jest.restoreAllMocks());

  it('posts the business name and shows the returned caption', async () => {
    const fetchSpy = respond(200, {
      caption: 'Fresh coffee from 6am. #BondiCafe',
      model: 'gemini-2.5-flash',
      tier: 'free',
    });

    render(<CaptionDemo />);
    submit('  Bondi Cafe ');

    expect(
      await screen.findByText('Fresh coffee from 6am. #BondiCafe')
    ).toBeInTheDocument();
    expect(screen.getByText('Your caption')).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/demo/caption',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ businessName: 'Bondi Cafe' }),
      })
    );
  });

  it('labels a curated fallback as a sample, not as AI output', async () => {
    respond(200, { caption: 'Sample text', model: 'sample', tier: 'sample' });

    render(<CaptionDemo />);
    submit('Acme');

    expect(await screen.findByText('Sample text')).toBeInTheDocument();
    expect(screen.getByText(/^Sample caption/)).toBeInTheDocument();
    expect(screen.queryByText('Your caption')).not.toBeInTheDocument();
  });

  it('shows a friendly message when rate limited', async () => {
    respond(429, { error: 'Too many requests' });

    render(<CaptionDemo />);
    submit('Acme');

    expect(await screen.findByText(/wait a minute/i)).toBeInTheDocument();
  });

  it('shows an error, not a crash, when the request fails', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    render(<CaptionDemo />);
    submit('Acme');

    expect(
      await screen.findByText(/could not generate a caption/i)
    ).toBeInTheDocument();
  });
});

describe('/demo page', () => {
  const source = readFileSync(
    path.join(__dirname, '../../app/demo/DemoClient.tsx'),
    'utf8'
  );

  it('renders the caption generator', () => {
    expect(source).toContain('<CaptionDemo />');
  });

  it('links to no /demo/* sub-route (none exist besides settings/integrations)', () => {
    expect(source).not.toMatch(/['"]\/demo\/[a-z-]+['"]/);
  });
});
