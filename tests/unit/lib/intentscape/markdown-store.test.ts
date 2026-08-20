import { Blob as NodeBlob } from 'node:buffer';
import type { SupabaseClient } from '@/lib/platform/noop-client';
import {
  createSupabaseMarkdownArtifactStore,
  INTENTSCAPE_WIKI_BUCKET,
  MarkdownArtifactIntegrityError,
  MarkdownArtifactValidationError,
} from '@/lib/intentscape/markdown-store';

interface UploadOptions {
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
}

class FakePrivateBucket {
  readonly objects = new Map<string, Buffer>();
  readonly uploads: Array<{
    path: string;
    options: UploadOptions;
  }> = [];
  tamperDownloads = false;

  async upload(path: string, body: Buffer, options: UploadOptions) {
    this.uploads.push({ path, options });
    if (this.objects.has(path) && !options.upsert) {
      return { data: null, error: { message: 'object already exists' } };
    }
    this.objects.set(path, Buffer.from(body));
    return { data: { path }, error: null };
  }

  async download(path: string) {
    const value = this.objects.get(path);
    if (!value) {
      return { data: null, error: { message: 'object not found' } };
    }
    const bytes = this.tamperDownloads
      ? Buffer.concat([value, Buffer.from('tampered')])
      : value;
    return { data: new NodeBlob([bytes]), error: null };
  }
}

function fixture() {
  const bucket = new FakePrivateBucket();
  const from = jest.fn((name: string) => {
    expect(name).toBe(INTENTSCAPE_WIKI_BUCKET);
    return bucket;
  });
  const client = { storage: { from } } as unknown as SupabaseClient;
  return {
    bucket,
    from,
    store: createSupabaseMarkdownArtifactStore(client),
  };
}

describe('IntentScape private Markdown artifact store', () => {
  it('writes an immutable, normalised Markdown version and verifies its hash', async () => {
    const { bucket, store } = fixture();

    const saved = await store.writeVersion({
      organizationId: 'org-alpha',
      workspaceId: 'workspace-1',
      logicalPath: 'context/field.md',
      version: 2,
      markdown: '# Context\r\n\r\nEvidence',
    });

    expect(saved.markdown).toBe('# Context\n\nEvidence\n');
    expect(saved.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(saved.storagePath).toMatch(
      /^org-alpha\/workspace-1\/context\/field\/v2-[0-9a-f]{16}[.]md$/
    );
    expect(saved.byteSize).toBe(Buffer.byteLength(saved.markdown));
    expect(bucket.uploads).toEqual([
      {
        path: saved.storagePath,
        options: {
          contentType: 'text/markdown',
          cacheControl: '0',
          upsert: false,
        },
      },
    ]);
  });

  it('reads only from the active organisation and verifies the expected hash', async () => {
    const { store } = fixture();
    const saved = await store.writeVersion({
      organizationId: 'org-alpha',
      workspaceId: 'workspace-1',
      logicalPath: 'README.md',
      version: 1,
      markdown: '# IntentScape',
    });

    await expect(
      store.readVersion({
        organizationId: 'org-alpha',
        workspaceId: 'workspace-1',
        storagePath: saved.storagePath,
        expectedHash: saved.contentHash,
      })
    ).resolves.toEqual(saved);

    await expect(
      store.readVersion({
        organizationId: 'org-bravo',
        workspaceId: 'workspace-1',
        storagePath: saved.storagePath,
        expectedHash: saved.contentHash,
      })
    ).rejects.toBeInstanceOf(MarkdownArtifactValidationError);
  });

  it.each([
    '../context.md',
    '/context/field.md',
    'context//field.md',
    'context/field.txt',
  ])('rejects unsafe logical path %s before upload', async logicalPath => {
    const { bucket, store } = fixture();

    await expect(
      store.writeVersion({
        organizationId: 'org-alpha',
        workspaceId: 'workspace-1',
        logicalPath,
        version: 1,
        markdown: '# Unsafe',
      })
    ).rejects.toBeInstanceOf(MarkdownArtifactValidationError);
    expect(bucket.uploads).toHaveLength(0);
  });

  it('rejects likely secrets before upload', async () => {
    const { bucket, store } = fixture();

    await expect(
      store.writeVersion({
        organizationId: 'org-alpha',
        workspaceId: 'workspace-1',
        logicalPath: 'context/field.md',
        version: 1,
        markdown: 'SUPABASE_SERVICE_ROLE_KEY=not-a-real-but-secret-value',
      })
    ).rejects.toThrow('secrets cannot be persisted');
    expect(bucket.uploads).toHaveLength(0);
  });

  it('rejects a non-positive version before upload', async () => {
    const { bucket, store } = fixture();

    await expect(
      store.writeVersion({
        organizationId: 'org-alpha',
        workspaceId: 'workspace-1',
        logicalPath: 'context/field.md',
        version: 0,
        markdown: '# Context',
      })
    ).rejects.toBeInstanceOf(MarkdownArtifactValidationError);
    expect(bucket.uploads).toHaveLength(0);
  });

  it('fails closed when the provider returns different bytes after upload', async () => {
    const { bucket, store } = fixture();
    bucket.tamperDownloads = true;

    await expect(
      store.writeVersion({
        organizationId: 'org-alpha',
        workspaceId: 'workspace-1',
        logicalPath: 'context/field.md',
        version: 1,
        markdown: '# Context',
      })
    ).rejects.toBeInstanceOf(MarkdownArtifactIntegrityError);
  });
});
