/**
 * POST /api/admin/blog/generate
 *
 * Generates an AI blog post and saves it as a draft for human review.
 * Protected by verifyAdmin (x-admin-api-key header or owner JWT).
 *
 * Body:
 *   topic    — the post topic/title prompt (required)
 *   category — taxonomy category (optional, AI will infer)
 *   publish  — if true, immediately sets status='published' (default false)
 *
 * The AI generates:
 *   - title, slug, excerpt (≤ 160 chars)
 *   - full markdown body (≥ 800 words)
 *   - category, tags (3–6 keywords)
 *   - seoTitle, seoDescription
 *   - readTime estimate
 *
 * @task UNI-1643
 */

import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/rate-limit/rate-limiter';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { verifyAdmin } from '@/lib/admin/verify-admin';
import { OpenRouterClient } from '@/lib/ai/openrouter-client';
import {
  governedCall,
  GovernorRefusedError,
  GOVERNOR_MODE,
  type ProviderCallResult,
} from '@/lib/ai/governor';
import {
  estimateTokens,
  governorRefusalResponse,
  resolveGovernorScope,
  unwrapGoverned,
} from '@/lib/ai/route-governance';

// ── Validation ────────────────────────────────────────────────────────────────

const GenerateSchema = z.object({
  topic: z.string().min(5).max(300),
  category: z.string().optional(),
  publish: z.boolean().optional().default(false),
});

// ── Slug utility ──────────────────────────────────────────────────────────────

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 230)); // ~230 wpm average
}

// ── AI prompt ─────────────────────────────────────────────────────────────────

function buildBlogPrompt(topic: string, category?: string): string {
  return `You are an expert content writer for Synthex — Australia's leading AI-powered social media marketing platform.

Write a high-quality blog post on the following topic:
"${topic}"

${category ? `Category: ${category}` : ''}

Requirements:
- Title: compelling, SEO-friendly, 50–70 characters
- Slug: URL-friendly version of the title (lowercase, hyphens only)
- Excerpt: 1–2 sentence summary, under 160 characters, no spoilers
- Content: full markdown post, minimum 800 words, structured with ## headings, practical examples
- Category: one of: strategy, platforms, ai-marketing, case-studies, tutorials, news
- Tags: 3–6 relevant keyword tags (array of lowercase strings)
- SEO title: 50–60 characters including "Synthex" or main keyword
- SEO description: 140–160 characters, action-oriented

Write in a confident, practical Australian tone. Use Australian spelling (organise, colour, recognise). Target audience: SME business owners and marketing managers.

Respond ONLY with valid JSON matching exactly this schema:
{
  "title": "string",
  "slug": "string",
  "excerpt": "string",
  "content": "string (markdown)",
  "category": "string",
  "tags": ["string"],
  "seoTitle": "string",
  "seoDescription": "string"
}`;
}

// ── Handler ───────────────────────────────────────────────────────────────────

async function _handlePost(request: NextRequest) {
  // ── Admin auth ────────────────────────────────────────────────────────────
  const auth = await verifyAdmin(request);
  if (!auth.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  const body = await request.json().catch(() => ({}));
  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { topic, category, publish } = parsed.data;

  // ── Generate with AI ──────────────────────────────────────────────────────
  const client = new OpenRouterClient();

  let generated: {
    title: string;
    slug: string;
    excerpt: string;
    content: string;
    category: string;
    tags: string[];
    seoTitle: string;
    seoDescription: string;
  };

  try {
    const prompt = buildBlogPrompt(topic, category);
    const callProvider = async (): Promise<ProviderCallResult<string>> => {
      const completion = await client.complete({
        model: client.models.creative, // Claude Sonnet for brand-quality copy
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });
      return {
        data: completion.choices[0]?.message?.content ?? '',
        inputTokens: completion.usage?.prompt_tokens ?? estimateTokens(prompt),
        outputTokens: completion.usage?.completion_tokens ?? 0,
        modelId: client.models.creative,
      };
    };

    // The organisation comes from the admin's session, never the body. An
    // admin-key call has no user and so no organisation to bill.
    const scope = auth.userId ? await resolveGovernorScope(auth.userId) : null;
    let raw: string;
    if (!scope) {
      if (GOVERNOR_MODE !== 'shadow') {
        return governorRefusalResponse(
          new GovernorRefusedError(
            'refused_flag_missing',
            'no organisation for this admin call'
          )
        );
      }
      logger.warn('Blog generation has no organisation; spend is unreceipted', {
        topic,
      });
      raw = (await callProvider()).data;
    } else {
      let providerError: { error: unknown } | null = null;
      const result = await governedCall<string>({
        organizationId: scope.organizationId,
        brandSlug: scope.brandSlug,
        runner: 'admin-blog-generate',
        provider: 'openrouter',
        model: { kind: 'registered', modelId: client.models.creative },
        pipelineName: 'admin-blog-generate',
        estimate: { inputTokens: estimateTokens(prompt), outputTokens: 4000 },
        mode: GOVERNOR_MODE,
        execute: async () => {
          try {
            return await callProvider();
          } catch (error) {
            providerError = { error };
            throw error;
          }
        },
      });
      raw = unwrapGoverned(result, providerError);
    }

    // Strip markdown code fences if the model wraps the JSON
    const jsonStr = raw
      .replace(/^```(?:json)?\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    generated = JSON.parse(jsonStr) as typeof generated;
  } catch (err) {
    if (err instanceof GovernorRefusedError) {
      return governorRefusalResponse(err);
    }
    logger.error('Blog generation AI call failed', { error: err, topic });
    return NextResponse.json(
      { error: 'AI generation failed', details: String(err) },
      { status: 502 }
    );
  }

  // ── Sanitise slug (ensure unique) ─────────────────────────────────────────
  let slug = toSlug(generated.slug || generated.title);

  // Append a short suffix if slug is already taken
  const existing = await prisma.blogPost.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // ── Persist to DB ─────────────────────────────────────────────────────────
  const wordCount = generated.content.trim().split(/\s+/).length;
  const readTime = estimateReadTime(generated.content);

  try {
    const post = await prisma.blogPost.create({
      data: {
        slug,
        title: generated.title,
        excerpt: generated.excerpt,
        content: generated.content,
        category: generated.category ?? category ?? 'strategy',
        tags: generated.tags ?? [],
        seoTitle: generated.seoTitle,
        seoDescription: generated.seoDescription,
        author: 'Synthex Team',
        wordCount,
        readTime,
        aiGenerated: true,
        aiModel: client.models.creative,
        status: publish ? 'published' : 'draft',
        publishedAt: publish ? new Date() : null,
      },
    });

    logger.info('Blog post generated', {
      postId: post.id,
      slug: post.slug,
      status: post.status,
      wordCount,
    });

    return NextResponse.json({ post, generated: true }, { status: 201 });
  } catch (err) {
    logger.error('Blog post DB insert failed', { error: err, slug });
    return NextResponse.json({ error: 'Failed to save post' }, { status: 500 });
  }
}

// RA-3024 — rate-limited wrapper around the existing handler.
export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => _handlePost(request));
}
