/**
 * User Repository Implementation
 * Handles user-specific data operations with advanced querying
 */

import { PrismaClient, User } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { SearchFilter, DomainError } from '../../architecture/layer-interfaces';

export interface UserWithProfile extends User {
  campaigns?: any[];
  projects?: any[];
  teamMemberships?: any[];
}

export interface UserSearchOptions {
  includeDeleted?: boolean;
  includeProfile?: boolean;
  includeCampaigns?: boolean;
  includeProjects?: boolean;
  includeTeamMemberships?: boolean;
}

export class UserRepository extends BaseRepository<User> {
  constructor(prisma: PrismaClient) {
    super(prisma, 'user');
  }

  /**
   * Find user by email with optional relations
   */
  async findByEmail(email: string, options: UserSearchOptions = {}): Promise<UserWithProfile | null> {
    try {
      const include = this.buildUserInclude(options);
      const where: any = { email: email.toLowerCase() };
      
      if (!options.includeDeleted) {
        where.isDeleted = false;
      }

      const user = await this.model.findUnique({
        where,
        include
      });

      return user;
    } catch (error) {
      throw new DomainError(
        `Failed to find user by email: ${email}`,
        'FIND_USER_BY_EMAIL_ERROR',
        500,
        { email, options },
        error as Error
      );
    }
  }

  /**
   * Find user by Google ID
   */
  async findByGoogleId(googleId: string): Promise<User | null> {
    try {
      const user = await this.model.findFirst({
        where: {
          googleId,
          isDeleted: false
        }
      });

      return user;
    } catch (error) {
      throw new DomainError(
        `Failed to find user by Google ID: ${googleId}`,
        'FIND_USER_BY_GOOGLE_ID_ERROR',
        500,
        { googleId },
        error as Error
      );
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.model.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          updatedAt: new Date()
        }
      });
    } catch (error) {
      throw new DomainError(
        `Failed to update last login for user: ${userId}`,
        'UPDATE_LAST_LOGIN_ERROR',
        500,
        { userId },
        error as Error
      );
    }
  }

  /**
   * Update user profile information
   */
  async updateProfile(userId: string, updates: {
    name?: string;
    avatar?: string;
    preferences?: any;
    metadata?: any;
  }): Promise<User> {
    try {
      const user = await this.model.update({
        where: { id: userId },
        data: {
          ...updates,
          updatedAt: new Date()
        }
      });

      return user;
    } catch (error) {
      throw new DomainError(
        `Failed to update user profile: ${userId}`,
        'UPDATE_USER_PROFILE_ERROR',
        400,
        { userId, updates },
        error as Error
      );
    }
  }

  /**
   * Update user's Google information
   */
  async updateGoogleInfo(userId: string, googleInfo: {
    googleId?: string;
    avatar?: string;
    lastLoginAt?: Date;
  }): Promise<User> {
    try {
      const user = await this.model.update({
        where: { id: userId },
        data: {
          ...googleInfo,
          updatedAt: new Date()
        }
      });

      return user;
    } catch (error) {
      throw new DomainError(
        `Failed to update Google info for user: ${userId}`,
        'UPDATE_GOOGLE_INFO_ERROR',
        400,
        { userId, googleInfo },
        error as Error
      );
    }
  }

  /**
   * Create user with Google OAuth data
   */
  async createGoogleUser(userData: {
    email: string;
    name: string;
    googleId: string;
    avatar?: string;
  }): Promise<User> {
    try {
      const now = new Date();
      const user = await this.model.create({
        data: {
          email: userData.email.toLowerCase(),
          name: userData.name,
          googleId: userData.googleId,
          avatar: userData.avatar,
          isEmailVerified: true, // Google emails are pre-verified
          lastLoginAt: now,
          createdAt: now,
          updatedAt: now
        }
      });

      return user;
    } catch (error) {
      throw new DomainError(
        `Failed to create Google user: ${userData.email}`,
        'CREATE_GOOGLE_USER_ERROR',
        400,
        { userData },
        error as Error
      );
    }
  }

  /**
   * Find active users by team ID
   * NOTE: This method is currently disabled as teamMemberships relation is not defined in the schema
   */
  async findByTeamId(teamId: string): Promise<User[]> {
    // Blocked: Requires teamMemberships relation in Prisma schema (not yet defined)
    return [];
    
    // Original implementation commented out:
    // try {
    //   const users = await this.prisma.user.findMany({
    //     where: {
    //       teamMemberships: {
    //         some: {
    //           teamId,
    //           isActive: true
    //         }
    //       },
    //       isDeleted: false
    //     },
    //     include: {
    //       teamMemberships: {
    //         where: {
    //           teamId,
    //           isActive: true
    //         }
    //       }
    //     }
    //   });
    //
    //   return users;
    // } catch (error) {
    //   throw new DomainError(
    //     `Failed to find users by team ID: ${teamId}`,
    //     'FIND_USERS_BY_TEAM_ERROR',
    //     500,
    //     { teamId },
    //     error as Error
    //   );
    // }
  }

  /**
   * Find users by role
   */
  async findByRole(role: string): Promise<User[]> {
    try {
      const users = await this.model.findMany({
        where: {
          role,
          isDeleted: false
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      return users;
    } catch (error) {
      throw new DomainError(
        `Failed to find users by role: ${role}`,
        'FIND_USERS_BY_ROLE_ERROR',
        500,
        { role },
        error as Error
      );
    }
  }

  /**
   * Search users with advanced filtering
   */
  async searchUsers(searchTerm: string, filters: {
    role?: string;
    isEmailVerified?: boolean;
    includeDeleted?: boolean;
    limit?: number;
  } = {}): Promise<UserWithProfile[]> {
    try {
      const where: any = {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } }
        ]
      };

      if (filters.role) {
        where.role = filters.role;
      }

      if (filters.isEmailVerified !== undefined) {
        where.isEmailVerified = filters.isEmailVerified;
      }

      if (!filters.includeDeleted) {
        where.isDeleted = false;
      }

      const users = await this.model.findMany({
        where,
        take: filters.limit || 50,
        orderBy: {
          updatedAt: 'desc'
        },
        include: {
          campaigns: {
            select: {
              id: true,
              name: true,
              status: true
            }
          },
          projects: {
            select: {
              id: true,
              name: true,
              status: true
            }
          }
        }
      });

      return users;
    } catch (error) {
      throw new DomainError(
        `Failed to search users with term: ${searchTerm}`,
        'SEARCH_USERS_ERROR',
        500,
        { searchTerm, filters },
        error as Error
      );
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(userId: string): Promise<{
    campaignsCount: number;
    projectsCount: number;
    totalContentGenerated: number;
    lastActivityAt: Date | null;
  }> {
    try {
      const [campaignsCount, projectsCount] = await Promise.all([
        this.prisma.campaign.count({
          where: {
            userId
            // isDeleted field not available in schema
          }
        }),
        this.prisma.project.count({
          where: {
            userId
            // isDeleted field not available in schema
          }
        })
      ]);

      // Get last activity from various sources
      const [lastCampaign, lastProject] = await Promise.all([
        this.prisma.campaign.findFirst({
          where: { userId }, // isDeleted field not available in schema
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true }
        }),
        this.prisma.project.findFirst({
          where: { userId }, // isDeleted field not available in schema
          orderBy: { updatedAt: 'desc' },
          select: { updatedAt: true }
        })
      ]);

      const lastActivityAt = [
        lastCampaign?.updatedAt,
        lastProject?.updatedAt
      ].filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0] || null;

      return {
        campaignsCount,
        projectsCount,
        totalContentGenerated: campaignsCount + projectsCount, // Simplified calculation
        lastActivityAt
      };
    } catch (error) {
      throw new DomainError(
        `Failed to get user statistics: ${userId}`,
        'GET_USER_STATS_ERROR',
        500,
        { userId },
        error as Error
      );
    }
  }

  /**
   * Soft delete user and related data
   * NOTE: Soft delete is not fully implemented as isDeleted and deletedAt fields are not in the schema
   */
  async softDelete(userId: string): Promise<void> {
    try {
      await this.executeInTransaction(async (tx) => {
        const now = new Date();

        // Delete user - since soft delete fields don't exist, we'll just anonymize the data
        await tx.user.update({
          where: { id: userId },
          data: {
            // isDeleted and deletedAt fields not available in schema
            updatedAt: now,
            // Anonymize sensitive data
            email: `deleted_${userId}@deleted.local`,
            name: 'Deleted User',
            googleId: null,
            avatar: null
          }
        });

        // Update related campaigns
        await tx.campaign.updateMany({
          where: { userId },
          data: {
            // isDeleted and deletedAt fields not available in schema
            updatedAt: now
          }
        });

        // Update related projects
        await tx.project.updateMany({
          where: { userId },
          data: {
            // isDeleted and deletedAt fields not available in schema
            updatedAt: now
          }
        });

        // Deactivate team memberships if the model exists
        // await tx.teamMember.updateMany({
        //   where: { userId },
        //   data: {
        //     isActive: false,
        //     updatedAt: now
        //   }
        // });
      });
    } catch (error) {
      throw new DomainError(
        `Failed to soft delete user: ${userId}`,
        'SOFT_DELETE_USER_ERROR',
        500,
        { userId },
        error as Error
      );
    }
  }

  /**
   * Build include clause for user queries
   */
  private buildUserInclude(options: UserSearchOptions): any {
    const include: any = {};

    if (options.includeCampaigns) {
      include.campaigns = {
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      };
    }

    if (options.includeProjects) {
      include.projects = {
        where: { isDeleted: false },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true
        }
      };
    }

    if (options.includeTeamMemberships) {
      include.teamMemberships = {
        where: { isActive: true },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              description: true
            }
          }
        }
      };
    }

    return Object.keys(include).length > 0 ? include : undefined;
  }

  /**
   * Validate user email uniqueness
   */
  async isEmailUnique(email: string, excludeUserId?: string): Promise<boolean> {
    try {
      const where: any = {
        email: email.toLowerCase(),
        isDeleted: false
      };

      if (excludeUserId) {
        where.id = { not: excludeUserId };
      }

      const count = await this.model.count({ where });
      return count === 0;
    } catch (error) {
      throw new DomainError(
        `Failed to check email uniqueness: ${email}`,
        'CHECK_EMAIL_UNIQUENESS_ERROR',
        500,
        { email, excludeUserId },
        error as Error
      );
    }
  }
}
