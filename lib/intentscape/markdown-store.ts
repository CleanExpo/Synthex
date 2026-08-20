import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@/lib/platform/noop-client';

export const INTENTSCAPE_WIKI_BUCKET = 'intentscape-wiki';
export const MAX_MARKDOWN_ARTIFACT_BYTES = 512 * 1024;

const SCOPED_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const LOGICAL_MARKDOWN_PATH = /^[A-Za-z0-9][A-Za-z0-9/_-]*[.]md$/;

const SECRET_PATTERNS: ReadonlyArray<{
  label: string;
  pattern: RegExp;
}> = [
  {
    label: 'service-role credential',
    pattern: /(?:SUPABASE_SERVICE_ROLE_KEY|LEGACY_PLATFORM_SERVICE_KEY)\s*[:=]\s*["']?[^\s"']{12,}/i,
  },
  {
    label: 'private key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  },
  {
    label: 'provider API credential',
    pattern: /\b(?:sk-proj|sk-ant|github_pat|ghp)_[A-Za-z0-9_-]{16,}/,
  },
  {
    label: 'JWT credential',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}[.][A-Za-z0-9_-]{8,}[.][A-Za-z0-9_-]{8,}\b/,
  },
];

export interface MarkdownArtifactWriteInput {
  organizationId: string;
  workspaceId: string;
  logicalPath: string;
  version: number;
  markdown: string;
}

export interface MarkdownArtifactReadInput {
  organizationId: string;
  workspaceId: string;
  storagePath: string;
  expectedHash: string;
}

export interface StoredMarkdownArtifact {
  storagePath: string;
  contentHash: string;
  byteSize: number;
  markdown: string;
}

export interface MarkdownArtifactStore {
  writeVersion(
    input: MarkdownArtifactWriteInput
  ): Promise<StoredMarkdownArtifact>;
  readVersion(
    input: MarkdownArtifactReadInput
  ): Promise<StoredMarkdownArtifact>;
}

export class MarkdownArtifactValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkdownArtifactValidationError';
  }
}

export class MarkdownArtifactStorageError extends Error {
  constructor(operation: 'upload' | 'download', message: string) {
    super(`IntentScape Markdown ${operation} failed: ${message}`);
    this.name = 'MarkdownArtifactStorageError';
  }
}

export class MarkdownArtifactIntegrityError extends Error {
  constructor() {
    super('IntentScape Markdown failed its content-hash integrity check.');
    this.name = 'MarkdownArtifactIntegrityError';
  }
}

function assertScopedId(value: string, label: string): void {
  if (!SCOPED_ID.test(value)) {
    throw new MarkdownArtifactValidationError(
      `${label} is not a safe path segment.`
    );
  }
}

function assertLogicalPath(logicalPath: string): void {
  if (
    !LOGICAL_MARKDOWN_PATH.test(logicalPath) ||
    logicalPath.includes('..') ||
    logicalPath.includes('//')
  ) {
    throw new MarkdownArtifactValidationError(
      'logicalPath must be a relative Markdown path without traversal segments.'
    );
  }
}

function assertVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new MarkdownArtifactValidationError(
      'version must be a positive integer.'
    );
  }
}

function assertNoSecrets(markdown: string): void {
  const detected = SECRET_PATTERNS.find(({ pattern }) =>
    pattern.test(markdown)
  );
  if (detected) {
    throw new MarkdownArtifactValidationError(
      `Markdown contains a possible ${detected.label}; secrets cannot be persisted.`
    );
  }
}

function normaliseMarkdown(markdown: string): string {
  const withoutBom = markdown.replace(/^\uFEFF/, '');
  const normalised = withoutBom.replace(/\r\n?/g, '\n');
  return normalised.endsWith('\n') ? normalised : `${normalised}\n`;
}

function hashMarkdown(markdown: string): string {
  return createHash('sha256').update(markdown, 'utf8').digest('hex');
}

function assertMarkdownSize(markdown: string): number {
  const byteSize = Buffer.byteLength(markdown, 'utf8');
  if (byteSize < 1 || byteSize > MAX_MARKDOWN_ARTIFACT_BYTES) {
    throw new MarkdownArtifactValidationError(
      `Markdown must be between 1 and ${MAX_MARKDOWN_ARTIFACT_BYTES} bytes.`
    );
  }
  return byteSize;
}

function expectedScopePrefix(
  organizationId: string,
  workspaceId: string
): string {
  assertScopedId(organizationId, 'organizationId');
  assertScopedId(workspaceId, 'workspaceId');
  return `${organizationId}/${workspaceId}/`;
}

function assertScopedStoragePath(
  storagePath: string,
  organizationId: string,
  workspaceId: string
): void {
  const scopePrefix = expectedScopePrefix(organizationId, workspaceId);
  if (
    !storagePath.startsWith(scopePrefix) ||
    storagePath.includes('..') ||
    storagePath.includes('//') ||
    !storagePath.endsWith('.md')
  ) {
    throw new MarkdownArtifactValidationError(
      'storagePath is outside the active organisation workspace.'
    );
  }
}

function buildStoragePath(
  input: Pick<
    MarkdownArtifactWriteInput,
    'organizationId' | 'workspaceId' | 'logicalPath' | 'version'
  >,
  contentHash: string
): string {
  const stem = input.logicalPath.slice(0, -3);
  return `${input.organizationId}/${input.workspaceId}/${stem}/v${input.version}-${contentHash.slice(0, 16)}.md`;
}

async function blobToMarkdown(data: Blob): Promise<string> {
  return Buffer.from(await data.arrayBuffer()).toString('utf8');
}

function safeStorageMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message.slice(0, 300);
  }
  return 'storage provider returned an unknown error';
}

export function createSupabaseMarkdownArtifactStore(
  client: SupabaseClient
): MarkdownArtifactStore {
  const bucket = client.storage.from(INTENTSCAPE_WIKI_BUCKET);

  return {
    async writeVersion(input) {
      expectedScopePrefix(input.organizationId, input.workspaceId);
      assertLogicalPath(input.logicalPath);
      assertVersion(input.version);
      assertNoSecrets(input.markdown);

      const markdown = normaliseMarkdown(input.markdown);
      const byteSize = assertMarkdownSize(markdown);
      const contentHash = hashMarkdown(markdown);
      const storagePath = buildStoragePath(input, contentHash);

      const upload = await bucket.upload(
        storagePath,
        Buffer.from(markdown, 'utf8'),
        {
          contentType: 'text/markdown',
          cacheControl: '0',
          upsert: false,
        }
      );
      if (upload.error) {
        throw new MarkdownArtifactStorageError(
          'upload',
          safeStorageMessage(upload.error)
        );
      }

      const downloaded = await bucket.download(storagePath);
      if (downloaded.error || !downloaded.data) {
        throw new MarkdownArtifactStorageError(
          'download',
          safeStorageMessage(downloaded.error)
        );
      }

      const persistedMarkdown = await blobToMarkdown(downloaded.data);
      if (hashMarkdown(persistedMarkdown) !== contentHash) {
        throw new MarkdownArtifactIntegrityError();
      }

      return { storagePath, contentHash, byteSize, markdown };
    },

    async readVersion(input) {
      assertScopedStoragePath(
        input.storagePath,
        input.organizationId,
        input.workspaceId
      );
      if (!/^[0-9a-f]{64}$/.test(input.expectedHash)) {
        throw new MarkdownArtifactValidationError(
          'expectedHash must be a SHA-256 hex digest.'
        );
      }

      const downloaded = await bucket.download(input.storagePath);
      if (downloaded.error || !downloaded.data) {
        throw new MarkdownArtifactStorageError(
          'download',
          safeStorageMessage(downloaded.error)
        );
      }

      const markdown = await blobToMarkdown(downloaded.data);
      const byteSize = assertMarkdownSize(markdown);
      const contentHash = hashMarkdown(markdown);
      if (contentHash !== input.expectedHash) {
        throw new MarkdownArtifactIntegrityError();
      }

      return {
        storagePath: input.storagePath,
        contentHash,
        byteSize,
        markdown,
      };
    },
  };
}

export function createProductionMarkdownArtifactStore(): MarkdownArtifactStore {
  return createSupabaseMarkdownArtifactStore(
    createClient()
  );
}
