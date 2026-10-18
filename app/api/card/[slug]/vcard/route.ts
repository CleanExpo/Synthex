/**
 * Public contact card — GET /api/card/[slug]/vcard
 *
 * Builds a vCard 3.0 from the published LinkBioPage behind the card: name,
 * title line and the visible links. Saving a contact needs no app and no
 * account; QR codes and NFC tags can point at the card page that links here.
 */
import { NextResponse } from 'next/server';
import { getCardConfig } from '@/lib/cards/white-rabbit';
import { prisma } from '@/lib/prisma';

function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
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
    `URL:${esc(cardUrl)}`,
    ...page.links.map(
      (l, i) =>
        `item${i + 1}.URL:${esc(l.url)}\r\nitem${i + 1}.X-ABLabel:${esc(l.title)}`
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
