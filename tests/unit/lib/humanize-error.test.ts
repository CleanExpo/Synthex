import {
  humanizeAiError,
  humanizePublishBlocker,
} from '@/lib/dashboard/humanize-error';

describe('humanizeAiError', () => {
  it('explains a missing API key without dumping provider text', () => {
    expect(humanizeAiError('User not found', 401)).toMatch(/AI Credentials/);
  });

  it('explains a rate limit', () => {
    expect(humanizeAiError('Rate limited', 429)).toMatch(/Wait a minute/);
  });

  it('hides token-like strings', () => {
    expect(humanizeAiError('Bearer sk-abc failed')).toMatch(/Try again/);
  });

  it('keeps a short human message', () => {
    expect(humanizeAiError('Please enter a topic')).toBe(
      'Please enter a topic'
    );
  });
});

describe('humanizePublishBlocker', () => {
  it('explains a missing Instagram connection', () => {
    expect(
      humanizePublishBlocker('platform_credentials_required', 400)
    ).toMatch(/Platforms/);
  });

  it('explains practice mode', () => {
    expect(humanizePublishBlocker('shadow mode — not live')).toMatch(
      /practice mode/
    );
  });
});
