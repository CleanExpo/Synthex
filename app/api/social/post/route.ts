/**
 * Unified Social Media Posting API
 * Handles posting to multiple social media platforms
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - DATABASE_URL: PostgreSQL connection (CRITICAL)
 * - FIELD_ENCRYPTION_KEY: 32-byte hex key for token encryption (CRITICAL)
 *
 * NOTE: OAuth tokens are encrypted at rest using AES-256-GCM
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import {
  getUserIdFromRequestOrCookies,
  unauthorizedResponse,
} from '@/lib/auth/jwt-utils';
import { decryptField } from '@/lib/security/field-encryption';
import { getEffectiveOrganizationId } from '@/lib/multi-business';
import {
  createPlatformService,
  type SupportedPlatform,
  type PlatformCredentials,
} from '@/lib/social';
import { buildTwitterPlatformCredentials } from '@/lib/social/twitter-oauth-credentials';
import { logger } from '@/lib/logger';
import { writeDefault } from '@/lib/rate-limit';
import { CAMPAIGN_AUTHORITY_MANIFEST_KEY } from '@/lib/marketing-agency/campaign-authority-manifest';
import { ensureCampaignAuthorityManifest } from '@/lib/marketing-agency/minimal-authority-manifest';
import { assertCampaignPublishable } from '@/lib/marketing-agency/publish-gate';
import {
  evaluateOwnedConnectionPublishGate,
  getOwnedProfileAllowlist,
} from '@/lib/social/owned-page-policy';
import { checkPublishingScopes } from '@/lib/social/publishing-scope-policy';

const socialPostSchema = z.object({
  content: z.string().min(1),
  platforms: z.array(z.string()).min(1),
  mediaUrls: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  hashtags: z.array(z.string()).optional().default([]),
  mentions: z.array(z.string()).optional().default([]),
  campaignId: z.string().optional(),
  campaignAuthorityManifest: z.unknown().optional(),
});

function jsonSafe(obj: Record<string, unknown>): any {
  return JSON.parse(JSON.stringify(obj));
}

export async function POST(request: NextRequest) {
  return writeDefault(request, async () => {
    try {
      // Check authentication and get user ID
      const userId = await getUserIdFromRequestOrCookies(request);
      if (!userId) {
        return unauthorizedResponse();
      }

      // Get org scope for multi-business support
      const organizationId = await getEffectiveOrganizationId(userId);

      // Parse and validate request body
      const rawBody = await request.json();
      const validation = socialPostSchema.safeParse(rawBody);
      if (!validation.success) {
        return NextResponse.json(
          { error: 'Invalid request data', details: validation.error.issues },
          { status: 400 }
        );
      }
      const {
        content,
        platforms,
        mediaUrls,
        scheduledAt,
        hashtags,
        mentions,
        campaignId,
        campaignAuthorityManifest,
      } = validation.data;

      const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
      if (scheduledAt && Number.isNaN(scheduledDate?.getTime())) {
        return NextResponse.json(
          { error: 'Invalid request data', details: 'scheduledAt is invalid' },
          { status: 400 }
        );
      }

      const existingCampaign = campaignId
        ? await prisma.campaign.findFirst({
            where: {
              id: campaignId,
              userId,
              deletedAt: null,
              ...(organizationId ? { organizationId } : {}),
            },
            select: {
              id: true,
              settings: true,
              content: true,
              analytics: true,
            },
          })
        : null;

      if (campaignId && !existingCampaign) {
        return NextResponse.json(
          { error: 'Campaign not found or not accessible' },
          { status: 404 }
        );
      }

      // Use an explicitly-supplied manifest (e.g. a CCW-style campaign manifest)
      // when present; otherwise auto-generate a minimal valid one so ordinary
      // self-authored posts pass the gate. ensureCampaignAuthorityManifest never
      // overrides an existing manifest, so CCW campaigns still require their real
      // evidence + human approval.
      const authorityManifest = ensureCampaignAuthorityManifest(
        {
          campaignId: existingCampaign?.id ?? campaignId,
          platforms,
          topic: content.slice(0, 80),
          idSeed: existingCampaign?.id ?? campaignId ?? content.slice(0, 40),
        },
        campaignAuthorityManifest,
        rawBody,
        existingCampaign?.settings,
        existingCampaign?.content,
        existingCampaign?.analytics
      );
      const publishGate = assertCampaignPublishable({
        manifest: authorityManifest,
        platforms,
        requestedAction: scheduledAt
          ? 'schedule_external_publish'
          : 'external_publish',
      });

      if (!publishGate.allowed) {
        return NextResponse.json(
          {
            error: 'Campaign authority gate blocked publishing',
            blockers: publishGate.blockers,
            warnings: publishGate.warnings,
            publishGate,
          },
          { status: 409 }
        );
      }

      // Process hashtags
      const processedHashtags = hashtags.map(tag =>
        tag.startsWith('#') ? tag : `#${tag}`
      );

      // Add hashtags to content if not already included
      let finalContent = content;
      const hashtagString = processedHashtags.join(' ');
      if (hashtagString && !content.includes(hashtagString)) {
        finalContent = `${content}\n\n${hashtagString}`;
      }

      const authorityMetadata = jsonSafe({
        [CAMPAIGN_AUTHORITY_MANIFEST_KEY]: authorityManifest,
        publishGate,
      });
      const existingSettings =
        existingCampaign?.settings &&
        typeof existingCampaign.settings === 'object' &&
        !Array.isArray(existingCampaign.settings)
          ? (existingCampaign.settings as Record<string, unknown>)
          : {};
      const campaignSettings = jsonSafe({
        ...existingSettings,
        ...authorityMetadata,
      });

      if (scheduledDate) {
        const { finalCampaignId, results } = await prisma.$transaction(
          async tx => {
            let txCampaignId = campaignId;
            if (!campaignId) {
              const campaign = await tx.campaign.create({
                data: {
                  name: `Social Post - ${new Date().toLocaleDateString()}`,
                  description: 'Auto-generated campaign for social media post',
                  platform: platforms.join(','),
                  status: 'active',
                  userId,
                  ...(organizationId ? { organizationId } : {}),
                  settings: campaignSettings,
                },
              });
              txCampaignId = campaign.id;
            }

            const scheduledResults: {
              platform: string;
              success: boolean;
              postId: string;
              platformPostId: string;
              url: string;
              message: string;
            }[] = [];

            for (const platform of platforms) {
              const post = await tx.post.create({
                data: {
                  content: finalContent,
                  platform,
                  status: 'scheduled',
                  scheduledAt: scheduledDate,
                  publishedAt: null,
                  campaignId: txCampaignId!,
                  metadata: jsonSafe({
                    hashtags: processedHashtags,
                    mentions,
                    mediaUrls,
                    scheduledByAuthorityGate: true,
                    ...authorityMetadata,
                  }),
                },
              });

              scheduledResults.push({
                platform,
                success: true,
                postId: post.id,
                platformPostId: '',
                url: '',
                message: `Scheduled ${platform} post`,
              });
            }

            if (txCampaignId) {
              await tx.campaign.update({
                where: { id: txCampaignId },
                data: {
                  analytics: {
                    postsCreated: scheduledResults.length,
                    platformsUsed: platforms,
                    lastScheduledAt: scheduledDate,
                  },
                  settings: campaignSettings,
                },
              });
            }

            return { finalCampaignId: txCampaignId, results: scheduledResults };
          }
        );

        return NextResponse.json({
          success: true,
          message: `Scheduled ${results.length} of ${platforms.length} platforms`,
          results,
          campaign: {
            id: finalCampaignId,
            postsCreated: results.length,
          },
          publishGate,
        });
      }

      // Post to each platform (external API calls — must happen outside transaction)
      const platformResults: {
        platform: string;
        connectionId: string;
        postId: string;
        url: string;
      }[] = [];
      const errors: { platform: string; success: boolean; error: string }[] =
        [];

      for (const platform of platforms) {
        try {
          // Get platform connection (scoped by organization)
          const connection = await prisma.platformConnection.findFirst({
            where: {
              userId,
              platform,
              organizationId: organizationId ?? null,
              isActive: true,
            },
            include: {
              organization: {
                select: { slug: true, settings: true },
              },
            },
          });

          if (!connection) {
            errors.push({
              platform,
              success: false,
              error: `Not connected to ${platform}. Please connect your ${platform} account in Settings.`,
            });
            continue;
          }

          const allowedProfileIds = getOwnedProfileAllowlist(
            connection.organization?.settings,
            platform
          );
          // The connection above is already scoped to this user's effective
          // organization (userId + organizationId + isActive), so it is one of
          // the team's OWN active-org accounts. Within that owned set, allow
          // ad-hoc publishing when the account is explicitly allowlisted OR is a
          // v1 auto-publish platform (IG/FB/LinkedIn) — no manual allowlist
          // script needed. OAuth publishing-scope verification below is the
          // hard gate that still blocks under-scoped accounts.
          const publishDecision = evaluateOwnedConnectionPublishGate({
            hasOrganization: Boolean(organizationId),
            platform,
            accountType: connection.accountType,
            profileId: connection.profileId,
            allowedProfileIds,
          });
          if (!publishDecision.allowed) {
            errors.push({
              platform,
              success: false,
              error: `Synthex blocked ${platform} publishing because the active OAuth connection is not an authorized owned page for this business.`,
            });
            continue;
          }

          const scopeCheck = checkPublishingScopes(platform, connection.scope);
          if (!scopeCheck.ok) {
            errors.push({
              platform,
              success: false,
              error: `Synthex blocked ${platform} publishing because the active OAuth connection is missing publishing scopes: ${scopeCheck.missing.join(', ')}.`,
            });
            continue;
          }

          // Build per-user credentials from stored OAuth tokens
          const accessToken = decryptField(connection.accessToken);
          if (!accessToken) {
            errors.push({
              platform,
              success: false,
              error: `Access token for ${platform} could not be decrypted. Please reconnect your account.`,
            });
            continue;
          }
          const credentials: PlatformCredentials =
            platform === 'twitter'
              ? buildTwitterPlatformCredentials({
                  accessToken,
                  refreshTokenDecrypted: connection.refreshToken
                    ? (decryptField(connection.refreshToken) ?? undefined)
                    : undefined,
                  expiresAt: connection.expiresAt,
                  metadata: connection.metadata,
                  platformUserId: connection.profileId ?? undefined,
                  platformUsername: connection.profileName ?? undefined,
                })
              : {
                  accessToken,
                  refreshToken: connection.refreshToken
                    ? (decryptField(connection.refreshToken) ?? undefined)
                    : undefined,
                  expiresAt: connection.expiresAt ?? undefined,
                  platformUserId: connection.profileId ?? undefined,
                  platformUsername: connection.profileName ?? undefined,
                };

          // Route token refresh through the cross-invocation advisory lock
          // (keyed by connection.id): it rotates the single-use refresh token
          // exactly once across serverless invocations and persists it
          // atomically (encrypted) inside the lock — no per-call-site
          // persistence callback needed.
          const service = createPlatformService(
            platform as SupportedPlatform,
            credentials,
            { connectionId: connection.id }
          );

          if (!service) {
            errors.push({
              platform,
              success: false,
              error: `Platform ${platform} is not supported`,
            });
            continue;
          }

          // Post via per-user OAuth token
          const result = await service.createPost({
            text: finalContent,
            mediaUrls,
          });

          if (!result.success || !result.postId) {
            throw new Error(result.error || `Failed to post to ${platform}`);
          }

          platformResults.push({
            platform,
            connectionId: connection.id,
            postId: result.postId,
            url: result.url || '',
          });
        } catch (error: unknown) {
          logger.error(`Error posting to ${platform}:`, error);
          errors.push({
            platform,
            success: false,
            error: `Failed to post to ${platform}`,
          });
        }
      }

      // Persist all DB writes atomically: campaign creation + post records + analytics
      const { finalCampaignId, results } = await prisma.$transaction(
        async tx => {
          // Create campaign if not provided
          let txCampaignId = campaignId;
          if (!campaignId) {
            const campaign = await tx.campaign.create({
              data: {
                name: `Social Post - ${new Date().toLocaleDateString()}`,
                description: 'Auto-generated campaign for social media post',
                platform: platforms.join(','),
                status: 'active',
                userId,
                ...(organizationId ? { organizationId } : {}),
                settings: campaignSettings,
              },
            });
            txCampaignId = campaign.id;
          }

          // Save all successful platform posts to database
          const postResults: {
            platform: string;
            success: boolean;
            postId: string;
            platformPostId: string;
            url: string;
            message: string;
          }[] = [];

          for (const result of platformResults) {
            const post = await tx.post.create({
              data: {
                content: finalContent,
                platform: result.platform,
                status: 'published',
                scheduledAt: null,
                publishedAt: new Date(),
                campaignId: txCampaignId!,
                metadata: jsonSafe({
                  platformPostId: result.postId,
                  url: result.url,
                  hashtags: processedHashtags,
                  mentions,
                  mediaUrls,
                  ...authorityMetadata,
                }),
              },
            });

            await tx.platformPost.upsert({
              where: {
                connectionId_platformId: {
                  connectionId: result.connectionId,
                  platformId: result.postId,
                },
              },
              create: {
                connectionId: result.connectionId,
                platformId: result.postId,
                content: finalContent,
                mediaUrls: mediaUrls ?? [],
                hashtags: processedHashtags,
                mentions,
                status: 'published',
                publishedAt: new Date(),
                metadata: jsonSafe({
                  url: result.url,
                  campaignId: txCampaignId,
                  postId: post.id,
                  source: 'api/social/post',
                  ...authorityMetadata,
                }),
              },
              update: {
                content: finalContent,
                mediaUrls: mediaUrls ?? [],
                hashtags: processedHashtags,
                mentions,
                status: 'published',
                publishedAt: new Date(),
                errorMessage: null,
                metadata: jsonSafe({
                  url: result.url,
                  campaignId: txCampaignId,
                  postId: post.id,
                  source: 'api/social/post',
                  ...authorityMetadata,
                }),
              },
            });

            postResults.push({
              platform: result.platform,
              success: true,
              postId: post.id,
              platformPostId: result.postId,
              url: result.url,
              message: `Successfully posted to ${result.platform}`,
            });
          }

          // Update campaign analytics
          if (txCampaignId) {
            await tx.campaign.update({
              where: { id: txCampaignId },
              data: {
                analytics: {
                  postsCreated: postResults.length,
                  platformsUsed: platforms,
                  lastPostedAt: new Date(),
                },
                settings: campaignSettings,
              },
            });
          }

          return { finalCampaignId: txCampaignId, results: postResults };
        }
      );

      // Return response
      return NextResponse.json({
        success: errors.length === 0,
        message: `Posted to ${results.length} of ${platforms.length} platforms`,
        results,
        errors: errors.length > 0 ? errors : undefined,
        campaign: {
          id: finalCampaignId,
          postsCreated: results.length,
        },
        publishGate,
      });
    } catch (error: unknown) {
      logger.error('Social posting error:', error);
      return NextResponse.json(
        {
          error: 'Failed to post to social media',
          message: 'An unexpected error occurred. Please try again.',
        },
        { status: 500 }
      );
    }
  });
}

// Get posting history
export async function GET(request: NextRequest) {
  try {
    // Check authentication and get user ID
    const userId = await getUserIdFromRequestOrCookies(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    const organizationId = await getEffectiveOrganizationId(userId);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Build query
    const where: Record<string, unknown> = {};
    if (platform) where.platform = platform;
    if (status) where.status = status;
    // Scope to current user via campaign relation
    where['campaign'] = {
      userId,
      ...(organizationId ? { organizationId } : { organizationId: null }),
    };

    // posts (filtered) and stats (all for user) are independent — run in parallel
    const [posts, stats] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      prisma.post.groupBy({
        by: ['platform', 'status'],
        where: {
          campaign: {
            userId,
            ...(organizationId ? { organizationId } : { organizationId: null }),
          },
        },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      posts,
      stats: stats.map(s => ({
        platform: s.platform,
        status: s.status,
        count: s._count.id,
      })),
      total: posts.length,
    });
  } catch (error: unknown) {
    logger.error('Get posts error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
