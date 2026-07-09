/**
 * Unit tests for the YouTube embed widget (SYN-509).
 *
 * Covers:
 *   • parseVideoId — safe ID extraction from bare IDs and every common URL form,
 *     and rejection of non-YouTube / malformed / injection-y inputs.
 *   • YouTubeEmbedWidget — renders a click-to-load poster, mounts the
 *     youtube-nocookie iframe with the correct src + accessible title on
 *     activation, honours autoLoad, and degrades gracefully on bad input.
 *
 * Placed under tests/unit/components (the discovered jest root) rather than
 * colocated, because the repo's jest config only matches tests under tests/**.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import {
  parseVideoId,
  isValidYouTubeInput,
  toNoCookieEmbedUrl,
} from '@/lib/youtube/parseVideoId';
import { YouTubeEmbedWidget } from '@/components/dashboard/YouTubeEmbedWidget';

const ID = 'dQw4w9WgXcQ';

describe('parseVideoId', () => {
  it.each([
    ['bare id', ID],
    ['watch url', `https://www.youtube.com/watch?v=${ID}`],
    ['watch url no www', `https://youtube.com/watch?v=${ID}`],
    [
      'watch url with extra params',
      `https://www.youtube.com/watch?v=${ID}&t=42s&list=PLabc`,
    ],
    ['short url', `https://youtu.be/${ID}`],
    ['short url with timestamp', `https://youtu.be/${ID}?t=42`],
    ['embed url', `https://www.youtube.com/embed/${ID}`],
    ['nocookie embed url', `https://www.youtube-nocookie.com/embed/${ID}`],
    ['shorts url', `https://www.youtube.com/shorts/${ID}`],
    ['live url', `https://www.youtube.com/live/${ID}`],
    ['scheme-less host', `youtu.be/${ID}`],
    ['protocol-relative', `//www.youtube.com/watch?v=${ID}`],
  ])('extracts the id from %s', (_label, input) => {
    expect(parseVideoId(input)).toBe(ID);
  });

  it.each([
    ['empty', ''],
    ['whitespace', '   '],
    ['null', null],
    ['undefined', undefined],
    ['too short', 'abc'],
    ['wrong charset', 'dQw4w9WgX!Q'],
    ['non-youtube host', 'https://evil.com/watch?v=' + ID],
    ['lookalike host', 'https://youtube.com.evil.com/watch?v=' + ID],
    ['no video id', 'https://www.youtube.com/feed/subscriptions'],
    ['javascript uri', 'javascript:alert(1)'],
  ])('returns null for %s', (_label, input) => {
    expect(parseVideoId(input as string)).toBeNull();
  });

  it('isValidYouTubeInput reflects parseVideoId', () => {
    expect(isValidYouTubeInput(`https://youtu.be/${ID}`)).toBe(true);
    expect(isValidYouTubeInput('nope')).toBe(false);
  });

  it('toNoCookieEmbedUrl builds a privacy-friendly src', () => {
    const url = toNoCookieEmbedUrl(`https://youtu.be/${ID}`);
    expect(url).toContain('https://www.youtube-nocookie.com/embed/' + ID);
    expect(url).toContain('rel=0');
    expect(toNoCookieEmbedUrl('nope')).toBeNull();
    expect(toNoCookieEmbedUrl(ID, { autoplay: true })).toContain('autoplay=1');
  });
});

describe('YouTubeEmbedWidget', () => {
  it('renders a click-to-load poster (no iframe) by default', () => {
    render(
      <YouTubeEmbedWidget video={`https://youtu.be/${ID}`} title="Demo video" />
    );
    expect(screen.getByTestId('youtube-embed-poster')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
    // accessible play label
    expect(screen.getByText('Play video: Demo video')).toBeInTheDocument();
  });

  it('mounts the nocookie iframe with correct src + title after activation', () => {
    render(<YouTubeEmbedWidget video={ID} title="Demo video" />);
    fireEvent.click(screen.getByTestId('youtube-embed-poster'));
    const iframe = document.querySelector('iframe')!;
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toContain(
      `https://www.youtube-nocookie.com/embed/${ID}`
    );
    expect(iframe.getAttribute('src')).toContain('autoplay=1');
    expect(iframe.getAttribute('title')).toBe('Demo video');
    expect(iframe.getAttribute('loading')).toBe('lazy');
  });

  it('honours autoLoad by mounting the iframe immediately (no autoplay)', () => {
    render(<YouTubeEmbedWidget video={ID} title="Auto" autoLoad />);
    const iframe = document.querySelector('iframe')!;
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toContain(
      `https://www.youtube-nocookie.com/embed/${ID}`
    );
    expect(iframe.getAttribute('src')).not.toContain('autoplay=1');
    expect(screen.queryByTestId('youtube-embed-poster')).toBeNull();
  });

  it('uses a 16:9 responsive wrapper and exposes the parsed id', () => {
    render(
      <YouTubeEmbedWidget
        video={`https://www.youtube.com/watch?v=${ID}`}
        title="x"
      />
    );
    const wrapper = screen.getByTestId('youtube-embed');
    expect(wrapper).toHaveClass('aspect-video');
    expect(wrapper.getAttribute('data-video-id')).toBe(ID);
  });

  it('degrades gracefully on unparseable input', () => {
    render(<YouTubeEmbedWidget video="https://evil.com/x" title="x" />);
    expect(screen.getByTestId('youtube-embed-invalid')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
