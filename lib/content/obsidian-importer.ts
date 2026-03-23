import { Prisma } from '@prisma/client';

import {
  parseObsidianNote,
  ObsidianParseResult,
} from '@/lib/markdown/obsidian-parser';
import { readNote, isEnabled } from '@/lib/obsidian/client';
import { prisma } from '@/lib/prisma';

/**
 * Preview an Obsidian note import — parses markdown, returns structured result.
 * No DB write at this stage.
 *
 * Supports two input modes:
 *   - markdown: raw markdown string (paste/upload mode)
 *   - notePath: vault-relative path (requires OBSIDIAN_ENABLED=true)
 */
export async function previewObsidianImport(input: {
  markdown?: string;
  notePath?: string;
}): Promise<ObsidianParseResult> {
  if ('notePath' in input && input.notePath !== undefined) {
    if (!isEnabled()) {
      throw new Error('Vault sync is not enabled in this environment');
    }
    const content = await readNote(input.notePath);
    return parseObsidianNote(content);
  }

  if ('markdown' in input && input.markdown !== undefined) {
    return parseObsidianNote(input.markdown);
  }

  throw new Error('Either markdown or notePath must be provided');
}

/**
 * Confirm an Obsidian import — creates a ContentDraft record.
 * Returns the new draft's ID.
 */
export async function confirmObsidianImport(
  preview: ObsidianParseResult,
  userId: string,
  organizationId: string | null
): Promise<{ draftId: string }> {
  const result = await prisma.contentDraft.create({
    data: {
      userId,
      organizationId,
      platform: preview.platform,
      content: preview.content,
      title: preview.title,
      hashtags: preview.hashtags,
      tone: preview.tone ?? null,
      topic: preview.topic ?? null,
      status: 'draft',
      metadata: {
        importedFrom: 'obsidian',
        frontMatter: preview.frontMatter,
      } as Prisma.InputJsonValue,
    },
  });

  return { draftId: result.id };
}
