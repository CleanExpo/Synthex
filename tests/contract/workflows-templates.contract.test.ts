/**
 * Contract tests for workflow templates API routes
 * Validates request/response shapes, auth guards, and org-scoping
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    workflowTemplate: { findMany: jest.fn(), create: jest.fn() },
  },
}))
jest.mock('@/lib/security/api-security-checker', () => ({
  APISecurityChecker: { check: jest.fn() },
  DEFAULT_POLICIES: { AUTHENTICATED_READ: 'read', AUTHENTICATED_WRITE: 'write' },
}))

import { APISecurityChecker } from '@/lib/security/api-security-checker'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const mockSecurityAllowed = { allowed: true, context: { userId: 'user-123' } }
const mockUser = { organizationId: 'org-456' }
const mockTemplate = { id: 'tmpl-001', organizationId: 'org-456', name: 'Content Pipeline', steps: [] }

describe('GET /api/workflows/templates', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue({ allowed: false, context: {} })
    const { GET } = await import('@/app/api/workflows/templates/route')
    const req = new NextRequest('http://localhost/api/workflows/templates')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns org-scoped templates', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.workflowTemplate.findMany as jest.Mock).mockResolvedValue([mockTemplate])
    const { GET } = await import('@/app/api/workflows/templates/route')
    const req = new NextRequest('http://localhost/api/workflows/templates')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.templates).toHaveLength(1)
  })
})

describe('POST /api/workflows/templates', () => {
  beforeEach(() => jest.clearAllMocks())

  it('creates template and returns 201', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    ;(prisma.workflowTemplate.create as jest.Mock).mockResolvedValue(mockTemplate)
    const { POST } = await import('@/app/api/workflows/templates/route')
    const req = new NextRequest('http://localhost/api/workflows/templates', {
      method: 'POST',
      body: JSON.stringify({ name: 'Content Pipeline', steps: [{ name: 'Generate', type: 'ai' }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })

  it('returns 400 for missing name', async () => {
    ;(APISecurityChecker.check as jest.Mock).mockResolvedValue(mockSecurityAllowed)
    ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser)
    const { POST } = await import('@/app/api/workflows/templates/route')
    const req = new NextRequest('http://localhost/api/workflows/templates', {
      method: 'POST',
      body: JSON.stringify({ steps: [{ name: 'Generate', type: 'ai' }] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
