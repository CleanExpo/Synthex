/**
 * Client Management API
 *
 * @description CRUD operations for agency clients and workspaces
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key (SECRET)
 *
 * FAILURE MODE: Returns error response with details
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { APISecurityChecker, DEFAULT_POLICIES } from '@/lib/security/api-security-checker';
import { auditLogger } from '@/lib/security/audit-logger';
import { clientManagement } from '@/lib/services/client-management';
import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Request validation schemas
const CreateClientSchema = z.object({
  name: z.string().min(1).max(100),
  domain: z.string().optional(),
  industry: z.string().optional(),
  timezone: z.string().default('UTC'),
  logo: z.string().url().optional(),
  brandGuidelines: z.object({
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    logo: z.string().optional(),
    fonts: z.object({
      heading: z.string(),
      body: z.string(),
    }).optional(),
    voiceTone: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    competitors: z.array(z.string()).optional(),
    hashtags: z.array(z.string()).optional(),
  }).optional(),
  settings: z.object({
    approvalRequired: z.boolean().optional(),
    autoPublish: z.boolean().optional(),
    defaultPlatforms: z.array(z.string()).optional(),
    postingFrequency: z.object({
      min: z.number(),
      max: z.number(),
      unit: z.enum(['day', 'week', 'month']),
    }).optional(),
    notifications: z.object({
      email: z.boolean(),
      slack: z.string().optional(),
      discord: z.string().optional(),
    }).optional(),
    contentGuidelines: z.string().optional(),
    restrictedTopics: z.array(z.string()).optional(),
  }).optional(),
});

const UpdateClientSchema = CreateClientSchema.partial().extend({
  status: z.enum(['active', 'paused', 'archived']).optional(),
  whiteLabel: z.object({
    enabled: z.boolean(),
    customDomain: z.string().optional(),
    logoUrl: z.string().optional(),
    faviconUrl: z.string().optional(),
    brandName: z.string().optional(),
    primaryColor: z.string().optional(),
    hideWatermark: z.boolean().optional(),
    customEmailDomain: z.string().optional(),
  }).optional(),
});

const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']),
  permissions: z.array(z.string()).optional(),
});

const UpdateMemberSchema = z.object({
  memberId: z.string(),
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  permissions: z.array(z.string()).optional(),
});

/**
 * GET /api/clients
 * Get clients or specific client
 */
export async function GET(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_READ
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    // Get user's organization
    const { data: userOrg } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    const organizationId = userOrg?.organization_id;

    // Get specific client
    const clientId = searchParams.get('id');
    if (clientId) {
      const client = await clientManagement.getClient(clientId, userId);
      if (!client) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Client not found or access denied' },
          404
        );
      }
      return APISecurityChecker.createSecureResponse({ client });
    }

    // Get active workspace
    if (searchParams.get('active') === 'true') {
      const activeClient = await clientManagement.getActiveWorkspace(userId);
      return APISecurityChecker.createSecureResponse({
        activeClient,
      });
    }

    // Get client members
    const forClientId = searchParams.get('members');
    if (forClientId) {
      const members = await clientManagement.getMembers(forClientId, userId);
      return APISecurityChecker.createSecureResponse({ members });
    }

    // Get client analytics
    const analyticsClientId = searchParams.get('analytics');
    if (analyticsClientId) {
      const start = searchParams.get('start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = searchParams.get('end') || new Date().toISOString();

      const analytics = await clientManagement.getClientAnalytics(
        analyticsClientId,
        userId,
        { start, end }
      );
      return APISecurityChecker.createSecureResponse({ analytics });
    }

    // Get all clients
    if (!organizationId) {
      return APISecurityChecker.createSecureResponse({ clients: [], total: 0 });
    }

    const status = searchParams.get('status') as any || 'active';
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await clientManagement.getClients(organizationId, {
      status,
      search: search || undefined,
      limit,
      offset,
    });

    return APISecurityChecker.createSecureResponse({
      clients: result.clients,
      total: result.total,
      limit,
      offset,
    });
  } catch (error: any) {
    logger.error('Client GET error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * POST /api/clients
 * Create a new client or perform member operations
 */
export async function POST(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();
    const action = searchParams.get('action');

    // Invite member
    if (action === 'invite') {
      const clientId = searchParams.get('clientId');
      if (!clientId) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Client ID required' },
          400
        );
      }

      const validated = InviteMemberSchema.parse(body);
      const result = await clientManagement.inviteMember(
        clientId,
        userId,
        validated.email,
        validated.role,
        validated.permissions
      );

      await auditLogger.logData(
        'create',
        'client',
        clientId,
        userId,
        'success',
        {
          action: 'CLIENT_MEMBER_INVITE',
          inviteeEmail: validated.email,
          role: validated.role,
        }
      );

      return APISecurityChecker.createSecureResponse(result, 201);
    }

    // Switch workspace
    if (action === 'switch') {
      const clientId = body.clientId;
      if (!clientId) {
        return APISecurityChecker.createSecureResponse(
          { error: 'Client ID required' },
          400
        );
      }

      await clientManagement.switchWorkspace(userId, clientId);

      return APISecurityChecker.createSecureResponse({
        success: true,
        activeClientId: clientId,
      });
    }

    // Create client
    const { data: userOrg } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .single();

    if (!userOrg?.organization_id) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Organization required to create clients' },
        400
      );
    }

    const validated = CreateClientSchema.parse(body);
    const client = await clientManagement.createClient(
      userOrg.organization_id,
      userId,
      validated
    );

    await auditLogger.logData(
      'create',
      'client',
      client.id,
      userId,
      'success',
      {
        action: 'CLIENT_CREATE',
        clientName: client.name,
      }
    );

    return APISecurityChecker.createSecureResponse({ client }, 201);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Client POST error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * PUT /api/clients
 * Update client or member
 */
export async function PUT(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const body = await request.json();
    const clientId = searchParams.get('id');

    if (!clientId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Client ID required' },
        400
      );
    }

    // Update member
    if (searchParams.get('member') === 'true') {
      const validated = UpdateMemberSchema.parse(body);
      const member = await clientManagement.updateMember(
        clientId,
        validated.memberId,
        userId,
        { role: validated.role, permissions: validated.permissions }
      );

      await auditLogger.logData(
        'update',
        'client',
        clientId,
        userId,
        'success',
        {
          action: 'CLIENT_MEMBER_UPDATE',
          memberId: validated.memberId,
          role: validated.role,
        }
      );

      return APISecurityChecker.createSecureResponse({ member });
    }

    // Update client
    const validated = UpdateClientSchema.parse(body);
    // Type assertion needed as Zod schema has optional nested fields
    const client = await clientManagement.updateClient(clientId, userId, validated as any);

    if (!client) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Client not found or access denied' },
        404
      );
    }

    await auditLogger.logData(
      'update',
      'client',
      clientId,
      userId,
      'success',
      {
        action: 'CLIENT_UPDATE',
        updates: Object.keys(validated),
      }
    );

    return APISecurityChecker.createSecureResponse({ client });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Validation error', details: error.errors },
        400
      );
    }

    logger.error('Client PUT error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: 'Internal server error' },
      500
    );
  }
}

/**
 * DELETE /api/clients
 * Archive client or remove member
 */
export async function DELETE(request: NextRequest) {
  // Security check
  const security = await APISecurityChecker.check(
    request,
    DEFAULT_POLICIES.AUTHENTICATED_WRITE
  );

  if (!security.allowed) {
    return APISecurityChecker.createSecureResponse(
      { error: security.error },
      403
    );
  }

  const userId = security.context.userId!;
  const { searchParams } = new URL(request.url);

  try {
    const clientId = searchParams.get('id');
    if (!clientId) {
      return APISecurityChecker.createSecureResponse(
        { error: 'Client ID required' },
        400
      );
    }

    // Remove member
    const memberId = searchParams.get('memberId');
    if (memberId) {
      await clientManagement.removeMember(clientId, memberId, userId);

      await auditLogger.logData(
        'delete',
        'client',
        clientId,
        userId,
        'success',
        { action: 'CLIENT_MEMBER_REMOVE', memberId }
      );

      return APISecurityChecker.createSecureResponse({ success: true });
    }

    // Archive client
    await clientManagement.archiveClient(clientId, userId);

    await auditLogger.logData(
      'delete',
      'client',
      clientId,
      userId,
      'success',
      { action: 'CLIENT_ARCHIVE' }
    );

    return APISecurityChecker.createSecureResponse({ success: true });
  } catch (error: any) {
    logger.error('Client DELETE error:', { error });
    return APISecurityChecker.createSecureResponse(
      { error: error.message || 'Internal server error' },
      500
    );
  }
}
