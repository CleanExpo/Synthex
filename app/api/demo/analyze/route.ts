import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { aiGeneration } from '@/lib/rate-limit';
import { detectIndustry } from '@/lib/demo/industry-classifier';
import { validateExternalUrl } from '@/lib/security/validate-url';

export const runtime = 'nodejs';
export const maxDuration = 20;

const RequestSchema = z.object({
  url: z.string().url('Must be a valid URL'),
});

export interface AnalyzeResult {
  businessName: string;
  description: string;
  industry: string;
  hasTitle: boolean;
  hasDescription: boolean;
  hasSocialLinks: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  loadedOk: boolean;
  caption: string;
  model: string;
  imageUrl: string;
  scores: {
    seo: number;
    presence: number;
    brand: number;
    overall: number;
  };
}

/** Pull plain text from raw HTML — strip tags, collapse whitespace.
 *  NOTE (SYN-871): reverted from stripHtmlToText (DOMPurify) which 500s on
 *  large fetched HTML in the Node serverless runtime. Re-uses the prior
 *  regex chain with /gi flags so case bypasses are still caught.
 *  Caps input at 200KB BEFORE regexes so megabyte-scale pages don't
 *  blow memory through global-replace allocations. */
function stripHtml(html: string): string {
  const boundedHtml = html.slice(0, 200_000);
  return boundedHtml
    .replace(/<script[^>]*>[\s\S]*?<\/\s*script\b[^>]*>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/\s*style\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000);
}

/** Extract <title> */
function extractTitle(html: string): string {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? '';
}

/** Extract meta description */
function extractMetaDesc(html: string): string {
  return (
    html
      .match(
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
      )?.[1]
      ?.trim() ??
    html
      .match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
      )?.[1]
      ?.trim() ??
    ''
  );
}

/** Crude heuristic — extract likely business name from title / OG / domain */
function extractBusinessName(html: string, url: string): string {
  const og =
    html.match(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i
    )?.[1];
  if (og) return og.trim();

  const title = extractTitle(html);
  if (title) {
    // "ACME Corp | Home" → "ACME Corp"
    const part = title.split(/[|\-–—]/)[0].trim();
    if (part.length > 1 && part.length < 60) return part;
  }

  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const raw = hostname.split('.')[0].replace(/-/g, ' ');
    // Try to detect word boundaries in slugs: "disasterrecovery" → "Disaster Recovery"
    // Insert space before runs of capitals or known word transitions
    const spaced = raw
      .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // ABCDef → ABC Def
      .replace(/\b\w/g, c => c.toUpperCase()); // title-case each word
    return spaced || 'Your Business';
  } catch {
    return 'Your Business';
  }
}

// SYN-853: detectIndustry extracted to lib/demo/industry-classifier.ts so
// the unit-test suite can import it without dragging in the rate-limiter →
// Redis → uncrypto ESM chain that breaks Jest. Behaviour unchanged.

/** Score the website on key signals — returns 0-100 */
function scoreWebsite(html: string, text: string) {
  let seo = 0;
  let presence = 0;
  let brand = 0;

  const title = extractTitle(html);
  const metaDesc = extractMetaDesc(html);

  // SEO
  if (title) seo += 25;
  if (metaDesc) seo += 25;
  if (/<h1/i.test(html)) seo += 20;
  if (/canonical/i.test(html)) seo += 15;
  if (/<meta[^>]+viewport/i.test(html)) seo += 15;

  // Social / presence
  const hasSocial = /instagram|facebook|twitter|linkedin|tiktok|youtube/i.test(
    html
  );
  const hasPhone = /\b0[2-9]\d{8}\b|\b\+61\b|\b13\s?\d{4}\b/.test(text);
  const hasAddress =
    /\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln)\b/i.test(text);
  if (hasSocial) presence += 35;
  if (hasPhone) presence += 30;
  if (hasAddress) presence += 20;
  if (/google.com\/maps|maps\.app/i.test(html)) presence += 15;

  // Brand
  const hasLogo = /<img[^>]+(logo|brand)/i.test(html) || /logo/i.test(html);
  const hasOG = /<meta[^>]+og:/i.test(html);
  const hasSchema = /application\/ld\+json/i.test(html);
  if (hasLogo) brand += 30;
  if (hasOG) brand += 35;
  if (hasSchema) brand += 35;

  const overall = Math.round((seo + presence + brand) / 3);

  return {
    seo: Math.min(seo, 100),
    presence: Math.min(presence, 100),
    brand: Math.min(brand, 100),
    overall: Math.min(overall, 100),
    hasTitle: !!title,
    hasDescription: !!metaDesc,
    hasSocialLinks: hasSocial,
    hasPhone,
    hasAddress,
  };
}

async function generateCaption(
  businessName: string,
  industry: string,
  description: string,
  geminiKey: string
): Promise<{ caption: string; model: string }> {
  const prompt = `Write a single Instagram caption (2-3 sentences, 1-2 hashtags) for an Australian ${industry} business called "${businessName}".${description ? ` About them: ${description.slice(0, 200)}` : ''} Conversational tone, no emojis. Return only the finished caption text, nothing else.`;

  const geminiController = new AbortController();
  const geminiTimer = setTimeout(() => geminiController.abort(), 12000);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      signal: geminiController.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.85,
          // Disable thinking mode — Gemini 2.5 Flash is a thinking model.
          // Without thinkingBudget:0 it returns a `thought:true` part first
          // containing mid-reasoning text, causing truncated output.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  );
  clearTimeout(geminiTimer);

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status}`);
  }

  const d = (await res.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string; thought?: boolean }>;
      };
    }>;
  };
  // Skip thinking-token parts (thought:true) and join only answer parts
  const rawParts = d?.candidates?.[0]?.content?.parts ?? [];
  const text = rawParts
    .filter(p => !p.thought)
    .map(p => p.text ?? '')
    .join('')
    .trim();

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return { caption: text, model: 'gemini-2.5-flash' };
}

function getPicsumUrl(industry: string): string {
  const map: Record<string, string> = {
    cafe: 'coffee-shop-cafe-food',
    restaurant: 'restaurant-food-dining',
    'beauty salon': 'beauty-hair-salon',
    'gym & fitness': 'fitness-gym-sport',
    trades: 'construction-building-tools',
    dental: 'dental-health-medical',
    'health & wellness': 'wellness-health-yoga',
    'real estate': 'architecture-property-home',
    'accounting & finance': 'business-office-professional',
    legal: 'business-office-professional',
    retail: 'retail-shop-fashion',
    technology: 'tech-office-modern',
    'cleaning & restoration': 'cleaning-professional-service',
    // SYN-853: new categories
    'education & training': 'education-classroom-learning',
    'B2B SaaS': 'business-software-dashboard',
    'local business': 'australian-business-local',
  };
  const seed = map[industry] ?? 'australian-business-local';
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/600`;
}

export async function POST(req: NextRequest) {
  return aiGeneration(req, async () => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid URL', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { url } = parsed.data;

    try {
      validateExternalUrl(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // --- Fetch the website (5s timeout) ---
    let html = '';
    let loadedOk = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; SynthexBot/1.0; +https://synthex.social)',
          Accept: 'text/html',
        },
      });
      clearTimeout(timer);
      if (res.ok) {
        // Cap response read at 500KB so megabyte-scale pages don't allocate
        // unbounded memory in the serverless function. stripHtml() further
        // bounds to 200KB before regex passes (SYN-871).
        html = (await res.text()).slice(0, 500_000);
        loadedOk = true;
      }
    } catch {
      // Site unreachable — proceed with domain-only analysis
    }

    const bodyText = stripHtml(html);
    const businessName = extractBusinessName(html, url);
    const metaDesc = extractMetaDesc(html);
    const industry = detectIndustry(bodyText);
    const scores = scoreWebsite(html, bodyText);

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      return NextResponse.json(
        { error: 'AI generation unavailable — GEMINI_API_KEY not configured' },
        { status: 503 }
      );
    }

    let captionResult: { caption: string; model: string };
    try {
      captionResult = await generateCaption(
        businessName,
        industry,
        metaDesc,
        geminiKey
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: `AI generation failed: ${msg}` },
        { status: 503 }
      );
    }

    const imageUrl = getPicsumUrl(industry);

    const result: AnalyzeResult = {
      businessName,
      description: metaDesc,
      industry,
      loadedOk,
      caption: captionResult.caption,
      model: captionResult.model,
      imageUrl,
      hasTitle: scores.hasTitle,
      hasDescription: scores.hasDescription,
      hasSocialLinks: scores.hasSocialLinks,
      hasPhone: scores.hasPhone,
      hasAddress: scores.hasAddress,
      scores: {
        seo: scores.seo,
        presence: scores.presence,
        brand: scores.brand,
        overall: scores.overall,
      },
    };

    return NextResponse.json(result);
  });
}
