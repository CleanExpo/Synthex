/**
 * Organisation access for server pages (SYN-1412).
 *
 * A server page that reads organisation data calls
 * `requireOrganisationPageAccess` before its first query. The caller is
 * identified from the verified `auth-token` cookie, the organisation is loaded
 * by slug, and the access rule of `lib/multi-business/business-scope.ts`
 * decides. An unknown organisation and a refused caller get the same
 * not-found, so the page does not reveal which slugs exist.
 *
 * A failed database read is never caught here: the request fails with the
 * error page. A check that could not be made is not shown as "no access".
 *
 * @module lib/auth/page-access
 */

import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { getUserIdFromCookies } from '@/lib/auth/jwt-utils';
import { logger } from '@/lib/logger';
import { checkOrganizationAccess } from '@/lib/multi-business/business-scope';

export interface PageOrganisation {
  id: string;
  name: string;
  slug: string;
}

export type OrganisationPageAccess =
  | { status: 'anonymous' }
  | { status: 'not_found' }
  | { status: 'forbidden'; userId: string }
  | { status: 'ok'; userId: string; organisation: PageOrganisation };

/**
 * Who is asking, and whether they may open pages of the organisation with this
 * slug. Pure: it never redirects and never raises not-found. Wrapped in React
 * `cache()` and keyed on the slug alone, so a layout and a page rendered in
 * one request share one resolution.
 *
 * @throws whatever a failed database read throws.
 */
export const resolveOrganisationPageAccess = cache(
  async (slug: string): Promise<OrganisationPageAccess> => {
    // No database read happens for an anonymous caller.
    const userId = await getUserIdFromCookies();
    if (!userId) {
      return { status: 'anonymous' };
    }

    const organisation = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });
    if (!organisation) {
      return { status: 'not_found' };
    }

    const allowed = await checkOrganizationAccess(userId, organisation.id);
    if (!allowed) {
      // Written here, inside the cached function, so a load that runs both the
      // layout and the page writes the line once.
      logger.warn('Organisation page access refused', {
        userId,
        slug,
        reason: 'access_check_false',
      });
      return { status: 'forbidden', userId };
    }

    return { status: 'ok', userId, organisation };
  }
);

/**
 * The gate for a server page. Returns the caller and the organisation when
 * access is allowed; otherwise it does not return.
 *
 * - No valid session: redirects to sign-in, in the proxy's format.
 * - Unknown organisation, or a caller with no access: not-found.
 *
 * @param slug The organisation slug the page is for.
 * @param returnTo The path to come back to after sign-in: a fixed path prefix
 *   plus the encoded segment.
 * @throws whatever a failed database read throws.
 */
export async function requireOrganisationPageAccess(
  slug: string,
  returnTo: string
): Promise<{ userId: string; organisation: PageOrganisation }> {
  const access = await resolveOrganisationPageAccess(slug);

  switch (access.status) {
    case 'anonymous':
      return redirect('/login?redirect=' + encodeURIComponent(returnTo));
    case 'not_found':
    case 'forbidden':
      return notFound();
    case 'ok':
      return { userId: access.userId, organisation: access.organisation };
  }
}
