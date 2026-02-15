/**
 * Author Schema API — Generate Person + ProfilePage JSON-LD
 *
 * GET /api/authors/:id/schema
 * Returns: { personSchema, profilePageSchema }
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL (CRITICAL)
 * - JWT_SECRET (CRITICAL)
 *
 * @module app/api/authors/[id]/schema/route
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserIdFromRequest } from '@/lib/auth/jwt-utils';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized', message: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const authorId = parseInt(id, 10);
    if (isNaN(authorId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const author = await prisma.authorProfile.findFirst({ where: { id: authorId, userId } });
    if (!author) {
      return NextResponse.json({ error: 'Not Found', message: 'Author profile not found' }, { status: 404 });
    }

    const credentials = (author.credentials as any[]) || [];
    const socialLinks = (author.socialLinks as Record<string, string>) || {};

    // Person schema
    const personSchema = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: author.name,
      description: author.bio.substring(0, 300),
      ...(author.avatarUrl && { image: author.avatarUrl }),
      ...(author.sameAsUrls.length > 0 && { sameAs: author.sameAsUrls }),
      ...(author.expertiseAreas.length > 0 && { knowsAbout: author.expertiseAreas }),
      ...(credentials.length > 0 && {
        alumniOf: credentials
          .filter(c => c.institution)
          .map(c => ({
            '@type': 'EducationalOrganization',
            name: c.institution,
          })),
        hasCredential: credentials.map(c => ({
          '@type': 'EducationalOccupationalCredential',
          credentialCategory: c.type,
          name: c.title,
          ...(c.institution && { recognizedBy: { '@type': 'Organization', name: c.institution } }),
        })),
      }),
    };

    // ProfilePage schema
    const profilePageSchema = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      mainEntity: {
        '@type': 'Person',
        name: author.name,
      },
      dateCreated: author.createdAt.toISOString(),
      dateModified: author.updatedAt.toISOString(),
    };

    return NextResponse.json({
      personSchema,
      profilePageSchema,
      jsonLd: `<script type="application/ld+json">${JSON.stringify(personSchema, null, 2)}</script>`,
    });
  } catch (error) {
    console.error('Author schema error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export const runtime = 'nodejs';
