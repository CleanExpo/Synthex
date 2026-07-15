/**
 * Autopilot grounded-image attachment (Real Images Only mandate,
 * .claude/rules/real-images-only.md · spec docs/specs/autopilot-grounded-images.md).
 *
 * The autonomous Autopilot loop generates text-only posts; this helper attaches
 * ONE real, grounded image to a would-be-scheduled post via the single sanctioned
 * entry point `generateImage()` — never a provider directly, never the
 * `useReferences: false` escape hatch.
 *
 * DARK-SAFETY INVARIANT: a post only stays 'scheduled' when a genuinely GROUNDED
 * image is produced. Any block (no owned references), failure, or defensively
 * unexpected ungrounded result downgrades the post to 'draft' for human pickup
 * and attaches NO image — never a placeholder/stock/ungrounded URL.
 */

import { logger } from '@/lib/logger';
import {
  generateImage,
  type ImageGenerationOptions,
  type ImageGenerationResult,
} from '@/lib/services/ai/image-generation';
import {
  systemGenerationContext,
  SUPPORTED_PLATFORMS,
  type SupportedPlatform,
} from '@/lib/ai/generation-context';
import type { ContentTheme } from '@/lib/autopilot/types';

export interface GroundedPostImageInput {
  businessName: string;
  industry: string;
  offerings: string[];
  theme: ContentTheme;
  /** Target social platform (drives visual-trend enrichment only). */
  platform: string;
  orgId: string;
  userId: string;
  /** Autopilot run id — used as the generation trace id. */
  runId: string;
}

export interface GroundedPostImageMeta {
  imageGrounded: boolean;
  imageReferenceSet?: string;
  imageRefCount?: number;
  imageBlocked?: boolean;
  imageBlockReason?: string;
  downgradeReason?: 'image-blocked';
}

export interface GroundedPostImageResult {
  images: string[];
  status: 'scheduled' | 'draft';
  meta: GroundedPostImageMeta;
}

/** Injectable dependencies (tests supply a fake generateImage). */
export interface GroundedPostImageDeps {
  generateImage: typeof generateImage;
}

const DEFAULT_DEPS: GroundedPostImageDeps = { generateImage };

/**
 * Build a real-scene image prompt from the owned slot data. `generateImage`
 * auto-detects the industry from this text and resolves owned references — a
 * bare, well-written prompt is already grounded + LoRA'd (grounded-visuals).
 */
function buildImagePrompt(input: GroundedPostImageInput): string {
  const subject = input.offerings.slice(0, 3).join(', ');
  const parts = [
    `Authentic professional photograph for ${input.businessName}`,
    input.industry ? `a ${input.industry} business` : '',
    subject ? `showing ${subject}` : '',
    'real on-the-job scene, natural lighting, documentary style',
  ].filter(Boolean);
  return parts.join(', ') + '.';
}

function toSupportedPlatform(platform: string): SupportedPlatform | undefined {
  const base = platform.split('_')[0];
  return (SUPPORTED_PLATFORMS as readonly string[]).includes(base)
    ? (base as SupportedPlatform)
    : undefined;
}

/**
 * Attempt to attach a grounded image to a scheduled autopilot post.
 * Callers invoke this ONLY for posts that would be scheduled — draft/reject
 * posts are not image-generated (bounds cost to one image per auto-published
 * post).
 */
export async function attachGroundedImage(
  input: GroundedPostImageInput,
  deps: GroundedPostImageDeps = DEFAULT_DEPS
): Promise<GroundedPostImageResult> {
  const options: ImageGenerationOptions = {
    prompt: buildImagePrompt(input),
    // Target platform (not provider) drives visual-trend enrichment. Grounding
    // stays default-on: useReferences is deliberately NOT set, and no legacy
    // provider is pinned.
    platform: toSupportedPlatform(input.platform),
  };

  const ctx = systemGenerationContext(input.orgId, {
    userId: input.userId,
    autonomyLevel: 'autonomous',
    traceId: input.runId,
  });

  let result: ImageGenerationResult;
  try {
    result = await deps.generateImage(options, ctx);
  } catch (error: unknown) {
    // A throw is not a licence to publish imageless — downgrade to draft.
    const reason = error instanceof Error ? error.message : String(error);
    logger.warn(
      'autopilot: grounded image generation threw; downgrading to draft',
      {
        orgId: input.orgId,
        runId: input.runId,
        error: reason,
      }
    );
    return {
      images: [],
      status: 'draft',
      meta: {
        imageGrounded: false,
        downgradeReason: 'image-blocked',
        imageBlockReason: reason,
      },
    };
  }

  const grounded =
    result.success && !!result.imageUrl && result.grounded === true;

  if (!grounded) {
    // BLOCKED / failed / defensively-ungrounded ⇒ NEVER auto-publish. No image
    // attached (no placeholder/stock/ungrounded URL), status downgraded to draft.
    logger.info(
      'autopilot: no grounded image — downgrading scheduled post to draft',
      {
        orgId: input.orgId,
        runId: input.runId,
        blocked: result.blocked ?? false,
        error: result.error,
      }
    );
    return {
      images: [],
      status: 'draft',
      meta: {
        imageGrounded: false,
        imageBlocked: result.blocked ?? false,
        imageBlockReason: result.error,
        downgradeReason: 'image-blocked',
      },
    };
  }

  return {
    images: [result.imageUrl as string],
    status: 'scheduled',
    meta: {
      imageGrounded: true,
      imageReferenceSet: result.referenceSet,
      imageRefCount: result.refCount,
    },
  };
}
