import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://synthex.social';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  category: string | null;
  tags: string[];
  ogImage: string | null;
  ogImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  readTime: number | null;
  wordCount: number | null;
  publishedAt: string | null;
  updatedAt: string;
  aiGenerated: boolean;
  views: number;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/blog/${encodeURIComponent(slug)}`,
      {
        next: { revalidate: 3600 },
      }
    );
    if (!res.ok) return null;
    return res.json() as Promise<BlogPost>;
  } catch {
    return null;
  }
}

// ── Metadata ──────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    return { title: 'Post Not Found | Synthex Blog' };
  }

  const title = post.seoTitle ?? `${post.title} | Synthex Blog`;
  const description = post.seoDescription ?? post.excerpt;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      url: `${BASE_URL}/blog/${slug}`,
      publishedTime: post.publishedAt ?? undefined,
      authors: [post.author],
      tags: post.tags,
      ...(post.ogImage
        ? {
            images: [
              {
                url: post.ogImage,
                alt: post.ogImageAlt ?? post.title,
                width: 1200,
                height: 630,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(post.ogImage ? { images: [post.ogImage] } : {}),
    },
    alternates: {
      canonical: `${BASE_URL}/blog/${slug}`,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  strategy: 'Strategy',
  platforms: 'Platforms',
  'ai-marketing': 'AI Marketing',
  'case-studies': 'Case Studies',
  tutorials: 'Tutorials',
  news: 'News',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  const categoryLabel =
    CATEGORY_LABELS[post.category ?? ''] ?? post.category ?? 'Article';

  return (
    <div className="min-h-screen bg-[#0A0A12]">
      {/* Back link */}
      <div className="max-w-3xl mx-auto px-6 pt-8">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-orange-400 text-sm transition-colors"
        >
          ← Back to Blog
        </Link>
      </div>

      {/* Hero */}
      <article className="max-w-3xl mx-auto px-6 py-10">
        {/* Category + meta */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-xs font-bold bg-orange-500/90 text-white px-2.5 py-1 rounded-full">
            {categoryLabel}
          </span>
          {post.publishedAt && (
            <span className="text-gray-500 text-sm">
              {formatDate(post.publishedAt)}
            </span>
          )}
          {post.readTime && (
            <span className="text-gray-500 text-sm">
              {post.readTime} min read
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
          {post.title}
        </h1>

        {/* Excerpt */}
        <p className="text-gray-400 text-lg leading-relaxed mb-8">
          {post.excerpt}
        </p>

        {/* Cover image */}
        {post.ogImage && (
          <div className="relative aspect-video rounded-xl overflow-hidden mb-10 bg-white/5">
            <Image
              src={post.ogImage}
              alt={post.ogImageAlt ?? post.title}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 768px"
            />
          </div>
        )}

        {/* Author row */}
        <div className="flex items-center gap-3 pb-8 border-b border-white/10 mb-10">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500/40 to-pink-500/40 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold">
              {post.author.charAt(0)}
            </span>
          </div>
          <div>
            <p className="text-white text-sm font-semibold">{post.author}</p>
            {post.wordCount && (
              <p className="text-gray-500 text-xs">
                {post.wordCount.toLocaleString('en-AU')} words
              </p>
            )}
          </div>
        </div>

        {/* Markdown content */}
        <div className="prose prose-invert prose-orange max-w-none prose-headings:font-black prose-headings:text-white prose-p:text-gray-300 prose-p:leading-relaxed prose-a:text-orange-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-orange-300 prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10 prose-li:text-gray-300 prose-blockquote:border-orange-500 prose-blockquote:text-gray-400">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-8 border-t border-white/10">
            {post.tags.map(tag => (
              <span
                key={tag}
                className="text-xs text-gray-400 bg-white/5 border border-white/10 rounded-full px-3 py-1"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Back CTA */}
        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300 font-semibold transition-colors"
          >
            ← Read more from the Synthex Blog
          </Link>
        </div>
      </article>
    </div>
  );
}
