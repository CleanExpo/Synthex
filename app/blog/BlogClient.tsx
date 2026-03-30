'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Edit3, Search } from '@/components/icons';
import MarketingLayout from '@/components/marketing/MarketingLayout';

// ── Types ─────────────────────────────────────────────────────────────────────

interface BlogPostSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  category: string | null;
  tags: string[];
  ogImage: string | null;
  readTime: number | null;
  publishedAt: string | null;
  aiGenerated: boolean;
}

interface BlogListResponse {
  posts: BlogPostSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchPosts(url: string): Promise<BlogListResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch posts');
  return res.json() as Promise<BlogListResponse>;
}

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

// ── Post card ─────────────────────────────────────────────────────────────────

function PostCard({ post }: { post: BlogPostSummary }) {
  const categoryLabel =
    CATEGORY_LABELS[post.category ?? ''] ?? post.category ?? 'Article';

  return (
    <Link href={`/blog/${post.slug}`} className="group block">
      <Card className="h-full bg-surface-base/80 backdrop-blur-md border border-orange-500/10 hover:border-orange-500/30 transition-all duration-200 overflow-hidden">
        {/* Cover image */}
        <div className="relative aspect-video bg-gradient-to-br from-orange-500/10 to-pink-500/10 overflow-hidden">
          {post.ogImage ? (
            <Image
              src={post.ogImage}
              alt={post.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Edit3 className="w-10 h-10 text-orange-400/30" />
            </div>
          )}
          {/* Category badge */}
          <div className="absolute top-3 left-3">
            <span className="text-xs font-bold bg-orange-500/90 text-white px-2.5 py-1 rounded-full">
              {categoryLabel}
            </span>
          </div>
        </div>

        <CardContent className="p-5">
          <h2 className="text-white font-bold text-lg leading-snug mb-2 group-hover:text-orange-400 transition-colors line-clamp-2">
            {post.title}
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-4 line-clamp-3">
            {post.excerpt}
          </p>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-gray-500 mt-auto pt-3 border-t border-white/5">
            <span>{post.author}</span>
            <div className="flex items-center gap-3">
              {post.readTime && <span>{post.readTime} min read</span>}
              {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PostCardSkeleton() {
  return (
    <div className="rounded-xl bg-surface-base/80 border border-orange-500/10 overflow-hidden animate-pulse">
      <div className="aspect-video bg-white/5" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-white/10 rounded w-4/5" />
        <div className="h-4 bg-white/10 rounded w-full" />
        <div className="h-4 bg-white/10 rounded w-3/5" />
        <div className="h-3 bg-white/5 rounded w-2/5 mt-4" />
      </div>
    </div>
  );
}

// ── Subscribe form (shown when no posts yet) ──────────────────────────────────

function ComingSoon() {
  return (
    <section className="px-6 pb-20">
      <div className="container mx-auto">
        <Card className="bg-surface-base/80 backdrop-blur-md border border-orange-500/20 p-16 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center mx-auto mb-6">
            <Edit3 className="w-7 h-7 text-orange-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">
            First article coming soon
          </h2>
          <p className="text-gray-400 mb-8">
            We&apos;re crafting in-depth guides on AI-powered social media
            marketing. Subscribe to be notified when we publish.
          </p>
          <form
            className="flex gap-2 max-w-sm mx-auto"
            onSubmit={e => e.preventDefault()}
          >
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 bg-surface-dark/80 border border-orange-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-400/50 transition-colors text-sm"
            />
            <Button
              type="submit"
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white shadow-lg shadow-orange-500/25"
            >
              <Mail className="w-4 h-4 mr-2" />
              Notify me
            </Button>
          </form>
        </Card>
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BlogClient() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [page, setPage] = useState(1);

  // Build API URL
  const params = new URLSearchParams({ page: String(page), limit: '12' });
  if (activeCategory) params.set('category', activeCategory);
  if (search.length >= 3) params.set('q', search);

  const { data, isLoading } = useSWR<BlogListResponse>(
    `/api/blog?${params.toString()}`,
    fetchPosts,
    { revalidateOnFocus: false }
  );

  const posts = data?.posts ?? [];
  const pagination = data?.pagination;
  const hasPosts = !isLoading && posts.length > 0;
  const isEmpty = !isLoading && posts.length === 0;

  const categories = Object.keys(CATEGORY_LABELS);

  return (
    <MarketingLayout currentPage="blog">
      {/* Hero */}
      <section className="pt-12 pb-8 px-6">
        <div className="container mx-auto text-center">
          <Edit3 className="w-16 h-16 text-orange-400 mx-auto mb-6" />
          <h1 className="text-5xl font-bold text-white mb-4">
            Synthex{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-300">
              Blog
            </span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Insights, strategies, and updates from the world of AI-powered
            social media marketing
          </p>
        </div>
      </section>

      {/* Search + filter bar */}
      {(hasPosts || isLoading) && (
        <section className="px-6 pb-8">
          <div className="container mx-auto">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              {/* Search */}
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="search"
                  placeholder="Search posts…"
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2.5 bg-surface-dark/80 border border-orange-500/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-orange-400/50 transition-colors text-sm"
                />
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setActiveCategory('');
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === ''
                      ? 'bg-orange-500 text-white'
                      : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  All
                </button>
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => {
                      setActiveCategory(cat);
                      setPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      activeCategory === cat
                        ? 'bg-orange-500 text-white'
                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Content */}
      <section className="px-6 pb-20">
        <div className="container mx-auto">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <PostCardSkeleton key={i} />
              ))}
            </div>
          ) : isEmpty ? (
            <ComingSoon />
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {posts.map(post => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-12">
                  <Button
                    variant="outline"
                    className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    ← Previous
                  </Button>
                  <span className="text-gray-400 text-sm">
                    Page {page} of {pagination.pages}
                  </span>
                  <Button
                    variant="outline"
                    className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    disabled={page >= pagination.pages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next →
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </MarketingLayout>
  );
}
