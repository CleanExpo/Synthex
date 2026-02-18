/**
 * Public Bio Page
 *
 * @description Renders a user's Link in Bio page publicly.
 * No authentication required. SEO optimized with Open Graph tags.
 */

import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import BioPageClient from './BioPageClient';

// =============================================================================
// Types
// =============================================================================

interface PageProps {
  params: Promise<{ slug: string }>;
}

// =============================================================================
// Data Fetching
// =============================================================================

async function getBioPage(slug: string) {
  const page = await prisma.linkBioPage.findUnique({
    where: { slug },
    include: {
      links: {
        where: { isVisible: true },
        orderBy: { order: 'asc' },
      },
    },
  });

  return page;
}

// =============================================================================
// Metadata
// =============================================================================

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getBioPage(slug);

  if (!page || !page.isPublished) {
    return {
      title: 'Page Not Found',
    };
  }

  const title = page.title;
  const description = page.bio || `${page.title}'s links and social profiles`;
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social'}/bio/${slug}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'profile',
      images: page.avatarUrl ? [{ url: page.avatarUrl }] : undefined,
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: page.avatarUrl ? [page.avatarUrl] : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

// =============================================================================
// Page Component
// =============================================================================

export default async function BioPage({ params }: PageProps) {
  const { slug } = await params;
  const page = await getBioPage(slug);

  if (!page || !page.isPublished) {
    notFound();
  }

  // Increment view count (fire and forget)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/bio/${page.id}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'view' }),
  }).catch(() => {});

  // Parse social links
  const socialLinks = Array.isArray(page.socialLinks)
    ? page.socialLinks as Array<{ platform: string; url: string }>
    : [];

  return (
    <BioPageClient
      page={{
        id: page.id,
        title: page.title,
        bio: page.bio,
        avatarUrl: page.avatarUrl,
        coverUrl: page.coverUrl,
        theme: page.theme,
        primaryColor: page.primaryColor,
        backgroundColor: page.backgroundColor,
        textColor: page.textColor,
        buttonStyle: page.buttonStyle,
        socialLinks,
        showBranding: page.showBranding,
      }}
      links={page.links.map(link => ({
        id: link.id,
        title: link.title,
        url: link.url,
        iconType: link.iconType,
        iconValue: link.iconValue,
        isHighlighted: link.isHighlighted,
      }))}
    />
  );
}
