import type { ReactNode } from 'react';
import { requireOrganisationPageAccess } from '@/lib/auth/page-access';

type LayoutCtx = {
  children: ReactNode;
  params: Promise<{ client: string }>;
};

/**
 * Second line, not the gate: every page under this segment that reads the
 * database calls `requireOrganisationPageAccess` itself. On a full load this
 * layout gives the client Studio shell the same sign-in redirect and not-found
 * as the server pages (SYN-1412).
 */
export default async function ClientLayout({ children, params }: LayoutCtx) {
  const { client } = await params;
  await requireOrganisationPageAccess(
    client,
    `/dashboard/marketing-agency/${encodeURIComponent(client)}`
  );

  return children;
}
