/**
 * MediaAttacher — concurrent upload and accepted file types.
 *
 * Founder brief 18/08/2026: adding video and audio files should be easy and
 * there should be fewer ways to get lost. Two defects sat behind that:
 *
 *  1. `processFiles` fires `void uploadFile(file)` per file without awaiting, and
 *     every concurrent call closed over the same `mediaUrls` snapshot. Each one
 *     then called `onMediaChange([...mediaUrls, itsOwnUrl])`, so the last upload
 *     to resolve overwrote the others. Dropping three files uploaded three files
 *     to storage but attached only one, with no error shown.
 *
 *  2. The `ACCEPT` list had no audio type and only `video/mp4`, so the file
 *     picker hid the mp3 the founder wanted to attach and the .mov his phone
 *     recorded.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { MediaAttacher } from '@/components/content/media-attacher';

jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}));

/** Resolves each upload in a staggered order so a snapshot race is deterministic. */
function mockUploadsResolvingInOrder(urls: string[]) {
  let call = 0;
  return jest.fn().mockImplementation(() => {
    const url = urls[call % urls.length];
    call += 1;
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data: { url } }),
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  // jsdom does not implement these.
  global.URL.createObjectURL = jest.fn(() => 'blob:preview');
  global.URL.revokeObjectURL = jest.fn();
});

function filesOf(...specs: Array<[string, string]>): File[] {
  return specs.map(([name, type]) => new File(['x'], name, { type }));
}

describe('MediaAttacher — concurrent uploads must not lose files', () => {
  it('attaches every file when three are dropped at once', async () => {
    global.fetch = mockUploadsResolvingInOrder([
      'https://cdn/one.jpg',
      'https://cdn/two.jpg',
      'https://cdn/three.jpg',
    ]) as unknown as typeof fetch;

    // The parent owns the list, so model it the way the real page does.
    let current: string[] = [];
    const onMediaChange = jest.fn((urls: string[]) => {
      current = urls;
    });

    const { container } = render(
      <MediaAttacher
        mediaUrls={[]}
        onMediaChange={onMediaChange}
        maxFiles={4}
      />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input).not.toBeNull();

    const files = filesOf(
      ['one.jpg', 'image/jpeg'],
      ['two.jpg', 'image/jpeg'],
      ['three.jpg', 'image/jpeg']
    );
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));

    // The defect: three uploads succeed but only the last survives the snapshot.
    await waitFor(() => expect(current).toHaveLength(3));
    expect(new Set(current).size).toBe(3);
  });
});

describe('MediaAttacher — accepted types', () => {
  it('lets the founder pick an audio file', () => {
    const { container } = render(
      <MediaAttacher mediaUrls={[]} onMediaChange={jest.fn()} />
    );
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input.getAttribute('accept')).toContain('audio/mpeg');
  });

  it('lets the founder pick the .mov an iPhone records', () => {
    const { container } = render(
      <MediaAttacher mediaUrls={[]} onMediaChange={jest.fn()} />
    );
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    expect(input.getAttribute('accept')).toContain('video/quicktime');
  });

  it('still accepts the original image and mp4 types', () => {
    const { container } = render(
      <MediaAttacher mediaUrls={[]} onMediaChange={jest.fn()} />
    );
    const accept = container
      .querySelector('input[type="file"]')!
      .getAttribute('accept')!;
    for (const type of [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'video/mp4',
    ]) {
      expect(accept).toContain(type);
    }
  });

  it('does not offer a type the server would reject', () => {
    const { container } = render(
      <MediaAttacher mediaUrls={[]} onMediaChange={jest.fn()} />
    );
    const accept = container
      .querySelector('input[type="file"]')!
      .getAttribute('accept')!;
    // The server allowlist has no PDF, so the picker must not suggest one.
    expect(accept).not.toContain('application/pdf');
  });
});

describe('MediaAttacher — respects the file cap', () => {
  it('does not upload past maxFiles', async () => {
    global.fetch = mockUploadsResolvingInOrder([
      'https://cdn/a.jpg',
    ]) as unknown as typeof fetch;

    const { container } = render(
      <MediaAttacher
        mediaUrls={['https://cdn/existing.jpg']}
        onMediaChange={jest.fn()}
        maxFiles={2}
      />
    );

    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const files = filesOf(
      ['a.jpg', 'image/jpeg'],
      ['b.jpg', 'image/jpeg'],
      ['c.jpg', 'image/jpeg']
    );
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // One slot free, so exactly one upload may start.
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  });
});
