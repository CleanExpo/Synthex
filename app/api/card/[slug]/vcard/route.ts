/**
 * Public contact card — GET /api/card/[slug]/vcard
 *
 * Builds a vCard 3.0 from the published LinkBioPage behind the card: name,
 * title line and the visible links. Saving a contact needs no app and no
 * account; QR codes and NFC tags can point at the card page that links here.
 */
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { readDefault } from '@/lib/rate-limit';
import { getCardConfig } from '@/lib/cards/white-rabbit';
import { prisma } from '@/lib/prisma';

// vCard 3.0 text values: escape backslash, CR/LF (as \n) and the , ; separators.
function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}
// URL is a uri value, not text: no backslash escaping (it would break links that contain , or ;),
// but a raw line break must never reach the card, so CR/LF are dropped.
function uri(value: string): string {
  return value.replace(/[\r\n]/g, '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  return readDefault(request, () => vcard(request, params));
}

async function vcard(request: NextRequest, params: Promise<{ slug: string }>) {
  const { slug } = await params;
  if (!getCardConfig(slug))
    return NextResponse.json({ error: 'Card not found' }, { status: 404 });
  const page = await prisma.linkBioPage.findFirst({
    where: { slug, isPublished: true },
    select: {
      title: true,
      bio: true,
      links: {
        where: { isVisible: true },
        orderBy: { order: 'asc' },
        select: { title: true, url: true },
      },
    },
  });
  if (!page)
    return NextResponse.json({ error: 'Card not published' }, { status: 404 });
  const cardUrl = new URL(`/card/${slug}`, request.url).toString();
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${esc(page.title)}`,
    ...(page.bio ? [`NOTE:${esc(page.bio)}`] : []),
    `URL:${uri(cardUrl)}`,
    ...page.links.map(
      (l, i) =>
        `item${i + 1}.URL:${uri(l.url)}\r\nitem${i + 1}.X-ABLabel:${esc(l.title)}`
    ),
    'END:VCARD',
  ];
  return new NextResponse(lines.join('\r\n') + '\r\n', {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}.vcf"`,
      'Cache-Control': 'no-store',
    },
  });
}
