/**
 * POST /api/agents/enhance-post
 *
 * Enhances a post for one or more social platforms via the Platform
 * Specialist Agent system.
 *
 * Auth: JWT via getUserIdFromRequestOrCookies
 * Org scoping: getEffectiveOrganizationId (multi-business aware)
 * Rate limit: 10 enhancements per minute per org (in addition to APISecurityChecker)
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getUserIdFromRequestOrCookies, unauthorizedResponse } from '@/lib/auth/jwt-utils'
import { getEffectiveOrganizationId } from '@/lib/multi-business/business-scope'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { logger } from '@/lib/logger'
import { SocialMediaOrchestrator } from '@/lib/agents/social-media-orchestrator'
import type { SocialPlatform } from '@/lib/agents/platform-specialist'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
// RATE LIMITER (10 per minute per org)
// ============================================================================

interface RateLimitEntry {
  count: number
  windowStart: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute

function checkRateLimit(orgId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(orgId)

  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(orgId, { count: 1, windowStart: now })
    return true
  }

  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// ============================================================================
// VALIDATION
// ============================================================================

const SOCIAL_PLATFORMS = [
  'twitter', 'linkedin', 'instagram', 'tiktok', 'facebook',
  'youtube', 'pinterest', 'reddit', 'threads',
] as const

const enhancePostSchema = z.object({
  postId: z.string().min(1),
  platforms: z.array(z.enum(SOCIAL_PLATFORMS)).optional(),
  enhanceAll: z.boolean().optional(),
})

// ============================================================================
// POST /api/agents/enhance-post
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Security check
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE)
  if (!security.allowed) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  // Auth
  const userId = await getUserIdFromRequestOrCookies(request)
  if (!userId) return unauthorizedResponse()

  // Org scoping
  const orgId = await getEffectiveOrganizationId(userId)
  if (!orgId) {
    return NextResponse.json({ error: 'No organisation context found' }, { status: 403 })
  }

  // Rate limit
  if (!checkRateLimit(orgId)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded — max 10 enhancements per minute per organisation' },
      { status: 429 }
    )
  }

  // Parse body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = enhancePostSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { postId, platforms, enhanceAll } = parsed.data

  try {
    // Verify post belongs to this org (via campaign)
    const post = await prisma.post.findFirst({
      where: {
        id: postId,
        deletedAt: null,
        campaign: { organizationId: orgId },
      },
      select: {
        id: true,
        content: true,
        platform: true,
        campaign: { select: { id: true } },
      },
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found or access denied' }, { status: 404 })
    }

    // Resolve platform list
    let targetPlatforms: SocialPlatform[]

    if (enhanceAll) {
      // Enhance for all supported platforms
      targetPlatforms = [...SOCIAL_PLATFORMS]
    } else if (platforms && platforms.length > 0) {
      targetPlatforms = platforms
    } else {
      // Default: enhance for the post's own platform
      targetPlatforms = [post.platform as SocialPlatform]
    }

    // Fetch org brand details for AI context
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { name: true, industry: true },
    })

    const businessName = org?.name ?? 'Unknown Business'
    const businessIndustry = org?.industry ?? undefined

    // Run the orchestrator
    const orchestrator = new SocialMediaOrchestrator()
    const result = await orchestrator.dispatchPost({
      postId,
      baseContent: post.content,
      platforms: targetPlatforms,
      orgId,
      businessName,
      businessIndustry,
    })

    logger.info('[enhance-post] Dispatch complete', {
      postId,
      orgId,
      dispatched: result.totalEnhanced,
      skipped: result.skipped.length,
    })

    return NextResponse.json({
      success: true,
      postId,
      enhanced: result.dispatched,
    })
  } catch (err) {
    logger.error('[enhance-post] POST failed', { postId, orgId, error: err })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
