/**
 * P2 u15: the media library, competitive intelligence and client videos
 * services depend on tables that are not in prisma/schema.prisma. Each call
 * must reject with a typed FEATURE_NOT_PROVISIONED error — never resolve with
 * empty data or silently drop a write.
 */
import {
  mediaLibraryService,
  MediaLibraryNotProvisionedError,
} from '@/lib/services/media-library';
import {
  competitiveIntel,
  CompetitiveIntelNotProvisionedError,
} from '@/lib/services/competitive-intel';
import {
  getClientVideos,
  ClientVideosNotProvisionedError,
} from '@/lib/videos/getClientVideos';

async function expectNotProvisioned(
  call: Promise<unknown>,
  ErrorClass: new (...args: never[]) => Error,
  table: string
) {
  const err = await call.then(
    () => {
      throw new Error('expected a FEATURE_NOT_PROVISIONED rejection');
    },
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(ErrorClass);
  expect(err).toMatchObject({ code: 'FEATURE_NOT_PROVISIONED', table });
  expect((err as Error).message).toContain(`the ${table} table`);
}

describe('media library (media_assets / media_folders not provisioned)', () => {
  const u = 'user-1';
  it.each([
    ['getAssets', () => mediaLibraryService.getAssets(u)],
    ['getAsset', () => mediaLibraryService.getAsset(u, 'a1')],
    [
      'createAsset',
      () =>
        mediaLibraryService.createAsset(u, { type: 'image', provider: 'fal' }),
    ],
    ['updateAsset', () => mediaLibraryService.updateAsset(u, 'a1', {})],
    ['deleteAsset', () => mediaLibraryService.deleteAsset(u, 'a1')],
    ['batchDelete', () => mediaLibraryService.batchDelete(u, ['a1'])],
    ['batchUpdate', () => mediaLibraryService.batchUpdate(u, ['a1'], {})],
    ['incrementUsage', () => mediaLibraryService.incrementUsage(u, 'a1')],
    ['getStats', () => mediaLibraryService.getStats(u)],
  ])('%s rejects with media_assets not provisioned', async (_n, call) => {
    await expectNotProvisioned(
      call(),
      MediaLibraryNotProvisionedError,
      'media_assets'
    );
  });

  it.each([
    ['getFolders', () => mediaLibraryService.getFolders(u)],
    ['createFolder', () => mediaLibraryService.createFolder(u, { name: 'x' })],
    ['updateFolder', () => mediaLibraryService.updateFolder(u, 'f1', {})],
    ['deleteFolder', () => mediaLibraryService.deleteFolder(u, 'f1')],
  ])('%s rejects with media_folders not provisioned', async (_n, call) => {
    await expectNotProvisioned(
      call(),
      MediaLibraryNotProvisionedError,
      'media_folders'
    );
  });
});

describe('competitive intelligence (competitors not provisioned)', () => {
  const u = 'user-1';
  it.each([
    [
      'addCompetitor',
      () => competitiveIntel.addCompetitor(u, { name: 'Acme', handles: {} }),
    ],
    ['getCompetitors', () => competitiveIntel.getCompetitors(u)],
    [
      'getCompetitorProfile',
      () => competitiveIntel.getCompetitorProfile('c1', 'instagram'),
    ],
    [
      'analyzeCompetitorContent',
      () => competitiveIntel.analyzeCompetitorContent('c1', 'instagram'),
    ],
    [
      'generateBenchmarkReport',
      () => competitiveIntel.generateBenchmarkReport(u),
    ],
    ['analyzeHashtags', () => competitiveIntel.analyzeHashtags(u, 'twitter')],
    [
      'identifyContentGaps',
      () => competitiveIntel.identifyContentGaps(u, 'twitter'),
    ],
    ['compareSentiment', () => competitiveIntel.compareSentiment(u, 'twitter')],
    ['getStrategicInsights', () => competitiveIntel.getStrategicInsights(u)],
  ])('%s rejects instead of returning empty results', async (_n, call) => {
    await expectNotProvisioned(
      call(),
      CompetitiveIntelNotProvisionedError,
      'competitors'
    );
  });
});

describe('getClientVideos (client_videos not provisioned)', () => {
  it('rejects instead of returning an empty list', async () => {
    await expectNotProvisioned(
      getClientVideos('client-1'),
      ClientVideosNotProvisionedError,
      'client_videos'
    );
  });
});
