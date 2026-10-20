/**
 * Render brand kit — the client's colour for burned-in video graphics
 *
 * Social cuts go out under the client's business name, so their captions carry
 * the client's own colour, never a fixed house style. The colour is resolved in
 * the order the client most deliberately set it: their default brand preset,
 * then the colour extracted into BrandDNA, then the organisation's
 * `primaryColor` (the one review emails and SEO articles already use).
 *
 * A kit is optional styling. Any lookup failure returns null so the renderer
 * falls back to its unbranded look; it never costs the client a cut.
 */
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { HEX_COLOR_REGEX } from '@/lib/marketing-agency/brand-style';
import { hasDirectOrganizationAccess } from '@/lib/multi-business';

export interface RenderBrandKit {
  /** Lower-case #rrggbb. */
  primaryColor: string;
  source: 'preset' | 'dna' | 'organization';
}

function validHex(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * Resolve the brand kit for a cut. `organizationId` is the organisation the
 * cut was made for (its `metadata.organizationId`): a multi-business owner's
 * cut for one client must carry that client's colour, not their home
 * organisation's. It is used only when the user may act for it directly;
 * otherwise the cut renders unbranded, never in another organisation's colour.
 * With no organisation given, the user's home organisation is used.
 */
export async function loadRenderBrandKitForUser(
  userId: string,
  organizationId?: string | null
): Promise<RenderBrandKit | null> {
  try {
    if (organizationId) {
      if (!(await hasDirectOrganizationAccess(userId, organizationId))) {
        logger.warn(
          'RenderBrandKit: user has no access to the cut organisation',
          {
            userId,
            organizationId,
          }
        );
        return null;
      }
      return await loadKitForOrganization(organizationId);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) return null;
    return await loadKitForOrganization(user.organizationId);
  } catch (err) {
    logger.warn('RenderBrandKit: lookup failed, rendering unbranded', {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function loadKitForOrganization(
  organizationId: string
): Promise<RenderBrandKit | null> {
  const preset = await prisma.brandPreset.findFirst({
    where: { organizationId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: { primaryColor: true },
  });
  const presetColor = validHex(preset?.primaryColor);
  if (presetColor) return { primaryColor: presetColor, source: 'preset' };

  const dna = await prisma.brandDNA.findUnique({
    where: { organizationId },
    select: { primaryColour: true },
  });
  const dnaColor = validHex(dna?.primaryColour);
  if (dnaColor) return { primaryColor: dnaColor, source: 'dna' };

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { primaryColor: true },
  });
  const orgColor = validHex(org?.primaryColor);
  if (orgColor) return { primaryColor: orgColor, source: 'organization' };

  return null;
}
