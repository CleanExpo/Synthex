/**
 * Digital business card — /card/[slug]
 *
 * DISCOVER (one practical action, no email), SOLVE (held until the deck, prize
 * and music are confirmed) and CONNECT (save the contact, approved links). The
 * profile and links come from the published LinkBioPage with the same slug.
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCardConfig } from '@/lib/cards/white-rabbit';
import { headers } from 'next/headers';
import { issueSessionFor } from '@/lib/learning-loop/assignment';
import { prisma } from '@/lib/prisma';
import CardClient from './CardClient';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ variant?: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: getCardConfig(slug) ? 'Follow the White Rabbit' : 'Card not found',
    robots: { index: false },
  };
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-vercel-forwarded-for') ||
    h.get('x-real-ip') ||
    'unknown'
  );
}

export default async function CardPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { variant } = await searchParams;
  const card = getCardConfig(slug);
  if (!card) notFound();
  const page = await prisma.linkBioPage.findFirst({
    where: { slug, isPublished: true },
    select: {
      title: true,
      bio: true,
      links: {
        where: { isVisible: true },
        orderBy: { order: 'asc' },
        select: { id: true, title: true, url: true },
      },
    },
  });
  if (!page) notFound();
  return (
    <CardClient
      slug={slug}
      profile={{ name: page.title, bio: page.bio }}
      links={page.links}
      card={card}
      forcedVariant={
        variant === 'story' || variant === 'plain' ? variant : null
      }
      issuedSession={
        variant === 'story' || variant === 'plain'
          ? null
          : await issueSessionFor(slug, await clientIp())
      }
    />
  );
}
