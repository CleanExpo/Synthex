/**
 * Brand Voice Score API — POST score content against brand voice
 * Phase 64: AI Quality & Brand Voice Guardian
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker'
import { QualityScorer } from '@/lib/brand-voice/quality-scorer'
import type { BrandVoiceProfile } from '@/lib/brand-voice/quality-scorer'

export const runtime = 'nodejs'

const scoreSchema = z.object({
  content: z.string().min(1).max(10000),
  personaId: z.string().cuid().optional(),
  orgId: z.string().optional(), // Optional — derived from auth if not provided
})

async function getOrgId(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { organizationId: true } })
  return user?.organizationId ?? null
}

export async function POST(request: NextRequest) {
  const security = await APISecurityChecker.check(request, DEFAULT_POLICIES.AUTHENTICATED_WRITE)
  if (!security.allowed || !security.context.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  const orgId = await getOrgId(security.context.userId)
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 })

  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }) }

  const parsed = scoreSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const { content, personaId } = parsed.data

  // Load brand voice profile from Persona if provided
  let brandVoice: BrandVoiceProfile | undefined
  if (personaId) {
    const persona = await prisma.persona.findFirst({
      where: { id: personaId, userId: security.context.userId },
      select: { name: true, tone: true, style: true, vocabulary: true, emotion: true },
    })
    if (persona) {
      brandVoice = {
        name: persona.name,
        tone: persona.tone,
        style: persona.style,
        vocabulary: persona.vocabulary,
        emotion: persona.emotion,
      }
    }
  }

  const scorer = new QualityScorer()
  const score = await scorer.scoreContent(content, brandVoice)

  return NextResponse.json({ score, brandVoice: brandVoice ?? null })
}
