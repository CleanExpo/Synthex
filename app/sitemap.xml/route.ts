/**
 * Dynamic Sitemap Route Handler
 *
 * Generates a comprehensive XML sitemap with video and image extensions.
 * Replaces the static public/sitemap.xml with auto-updating dates.
 */

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
  images?: Array<{ loc: string; title: string; caption?: string }>;
  videos?: Array<{
    thumbnailUrl: string;
    title: string;
    description: string;
    contentUrl: string;
    playerUrl: string;
    publicationDate: string;
  }>;
}

function buildSitemapEntries(): SitemapEntry[] {
  const today = new Date().toISOString().split('T')[0];

  return [
    {
      loc: '/',
      lastmod: today,
      changefreq: 'daily',
      priority: 1.0,
      images: [
        {
          loc: `${BASE_URL}/images/hero-robot.png`,
          title: 'Synthex AI Marketing Robot',
          caption: 'AI-powered marketing automation',
        },
      ],
      videos: [
        {
          thumbnailUrl: 'https://img.youtube.com/vi/7rRHU8xS-kU/maxresdefault.jpg',
          title: 'Synthex — AI-Powered Marketing Agency',
          description: 'Discover how Synthex uses AI to automate your entire social media marketing — from content creation to scheduling and analytics.',
          contentUrl: 'https://youtu.be/7rRHU8xS-kU',
          playerUrl: 'https://www.youtube.com/embed/7rRHU8xS-kU',
          publicationDate: '2026-02-17',
        },
      ],
    },
    { loc: '/features', lastmod: today, changefreq: 'weekly', priority: 0.9 },
    { loc: '/pricing', lastmod: today, changefreq: 'weekly', priority: 0.9 },
    { loc: '/about', lastmod: today, changefreq: 'monthly', priority: 0.8 },
    { loc: '/blog', lastmod: today, changefreq: 'weekly', priority: 0.8 },
    {
      loc: '/demo',
      lastmod: today,
      changefreq: 'weekly',
      priority: 0.8,
      videos: [
        {
          thumbnailUrl: 'https://img.youtube.com/vi/vnn6SJUlsWU/maxresdefault.jpg',
          title: 'Synthex Product Demo',
          description: 'Full product walkthrough of the Synthex AI marketing platform.',
          contentUrl: 'https://youtu.be/vnn6SJUlsWU',
          playerUrl: 'https://www.youtube.com/embed/vnn6SJUlsWU',
          publicationDate: '2026-02-17',
        },
      ],
    },
    { loc: '/docs', lastmod: today, changefreq: 'weekly', priority: 0.7 },
    { loc: '/api-reference', lastmod: today, changefreq: 'weekly', priority: 0.7 },
    { loc: '/case-studies', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { loc: '/support', lastmod: today, changefreq: 'monthly', priority: 0.6 },
    { loc: '/careers', lastmod: today, changefreq: 'monthly', priority: 0.6 },
    { loc: '/roadmap', lastmod: today, changefreq: 'weekly', priority: 0.6 },
    { loc: '/changelog', lastmod: today, changefreq: 'weekly', priority: 0.6 },
    { loc: '/contact', lastmod: today, changefreq: 'monthly', priority: 0.6 },
    { loc: '/security', lastmod: today, changefreq: 'monthly', priority: 0.5 },
    { loc: '/signup', lastmod: today, changefreq: 'monthly', priority: 0.7 },
    { loc: '/terms', lastmod: today, changefreq: 'yearly', priority: 0.3 },
    { loc: '/privacy', lastmod: today, changefreq: 'yearly', priority: 0.3 },
  ];
}

function entryToXml(entry: SitemapEntry): string {
  let xml = '  <url>\n';
  xml += `    <loc>${BASE_URL}${entry.loc}</loc>\n`;
  xml += `    <lastmod>${entry.lastmod}</lastmod>\n`;
  xml += `    <changefreq>${entry.changefreq}</changefreq>\n`;
  xml += `    <priority>${entry.priority}</priority>\n`;

  if (entry.images) {
    for (const img of entry.images) {
      xml += '    <image:image>\n';
      xml += `      <image:loc>${img.loc}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(img.title)}</image:title>\n`;
      if (img.caption) {
        xml += `      <image:caption>${escapeXml(img.caption)}</image:caption>\n`;
      }
      xml += '    </image:image>\n';
    }
  }

  if (entry.videos) {
    for (const vid of entry.videos) {
      xml += '    <video:video>\n';
      xml += `      <video:thumbnail_loc>${vid.thumbnailUrl}</video:thumbnail_loc>\n`;
      xml += `      <video:title>${escapeXml(vid.title)}</video:title>\n`;
      xml += `      <video:description>${escapeXml(vid.description)}</video:description>\n`;
      xml += `      <video:content_loc>${vid.contentUrl}</video:content_loc>\n`;
      xml += `      <video:player_loc>${vid.playerUrl}</video:player_loc>\n`;
      xml += `      <video:publication_date>${vid.publicationDate}</video:publication_date>\n`;
      xml += '    </video:video>\n';
    }
  }

  xml += '  </url>\n';
  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const entries = buildSitemapEntries();

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${entries.map(entryToXml).join('')}</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
