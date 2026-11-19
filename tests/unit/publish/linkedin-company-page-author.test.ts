/**
 * @jest-environment node
 *
 * SYN-1144 — the publish queue must post a LinkedIn company-page connection
 * AS the company page.
 *
 * A company-page connection stores the NUMERIC LinkedIn organisation id as its
 * profileId (OAuth callback organisation resolution, or the connection
 * organisation override route). LinkedInService.createPost already maps a
 * numeric id to `urn:li:organization:{id}`, but the queue's dispatch built
 * `urn:li:person:{id}` for every bare id, so a company-page post went out under
 * a person URN that does not exist and LinkedIn rejected it. These tests drive
 * the queue dispatch with the shapes stored in production and assert the URN
 * handed to the (mocked) provider adapter. No provider is called.
 */

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {},
  prisma: {},
}));
jest.mock('@/lib/publish/platformAdapters/linkedin', () => ({
  publishToLinkedIn: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/instagram', () => ({
  publishToInstagram: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/facebook', () => ({
  publishToFacebook: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/twitter', () => ({
  publishToTwitter: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/threads', () => ({
  publishToThreads: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/youtube', () => ({
  publishToYouTube: jest.fn(),
}));
jest.mock('@/lib/publish/platformAdapters/tiktok', () => ({
  publishToTikTok: jest.fn(),
}));
jest.mock('@/lib/publish/safetyChecks', () => ({
  runSafetyChecks: jest.fn(),
  resolveOrgAutoPublishGate: jest.fn(async () => ({ allowed: true })),
}));
jest.mock('@/components/marketing/PostAttributionFooter', () => ({
  buildAttribution: jest.fn(() => ({
    body: undefined,
    firstComment: undefined,
  })),
}));

import { dispatchToPlatform } from '@/lib/publish/publishQueue';
import { publishToLinkedIn } from '@/lib/publish/platformAdapters/linkedin';
import { linkedInAuthorUrn } from '@/lib/social/linkedin-organization';
import { buildAttribution } from '@/components/marketing/PostAttributionFooter';

const mockPublish = publishToLinkedIn as jest.Mock;

beforeEach(() => {
  (buildAttribution as jest.Mock).mockReturnValue({
    body: undefined,
    firstComment: undefined,
  });
  mockPublish.mockReset();
  mockPublish.mockResolvedValue({
    success: true,
    platformPostId: 'urn:li:share:1',
  });
});

async function authorFor(profileId: string): Promise<string> {
  await dispatchToPlatform('linkedin', 'tok', profileId, 'Caption');
  expect(mockPublish).toHaveBeenCalledTimes(1);
  return mockPublish.mock.calls[0][0].authorUrn;
}

describe('publish queue LinkedIn author URN (SYN-1144)', () => {
  it('posts a numeric organisation profileId as the company page', async () => {
    await expect(authorFor('112760720')).resolves.toBe(
      'urn:li:organization:112760720'
    );
  });

  it('posts an OpenID member id as the person', async () => {
    await expect(authorFor('aB3_xY-9')).resolves.toBe('urn:li:person:aB3_xY-9');
  });

  it('passes a full URN through unchanged', async () => {
    await expect(authorFor('urn:li:organization:42')).resolves.toBe(
      'urn:li:organization:42'
    );
    mockPublish.mockClear();
    await expect(authorFor('urn:li:person:abc')).resolves.toBe(
      'urn:li:person:abc'
    );
  });

  it('fails closed on an empty profileId without calling LinkedIn', async () => {
    const result = await dispatchToPlatform('linkedin', 'tok', '', 'Caption');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/profile id/i);
    expect(mockPublish).not.toHaveBeenCalled();
  });
});

describe('linkedInAuthorUrn (the one owner of the rule)', () => {
  it.each([
    ['112760720', 'urn:li:organization:112760720'],
    ['abc123', 'urn:li:person:abc123'],
    ['urn:li:organization:7', 'urn:li:organization:7'],
    ['  ', null],
    ['', null],
  ])('%j -> %j', (input, expected) => {
    expect(linkedInAuthorUrn(input)).toBe(expected);
  });
});
