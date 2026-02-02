/**
 * Database Test Helpers
 * Utilities for database testing with Prisma
 *
 * @task UNI-417 - Testing & Quality Assurance Epic
 *
 * Usage:
 * ```typescript
 * import { TestDatabase, TestDataFactory } from '@/lib/testing';
 *
 * describe('User Service', () => {
 *   const testDb = new TestDatabase();
 *   const factory = new TestDataFactory(testDb.prisma);
 *
 *   beforeAll(() => testDb.connect());
 *   afterAll(() => testDb.disconnect());
 *   beforeEach(() => testDb.reset());
 *
 *   it('creates user', async () => {
 *     const user = await factory.createUser({ email: 'test@example.com' });
 *     expect(user.id).toBeDefined();
 *   });
 * });
 * ```
 */

import { PrismaClient } from '@prisma/client';

// ============================================================================
// TEST DATABASE MANAGER
// ============================================================================

/**
 * Test database manager for isolation and cleanup
 */
export class TestDatabase {
  public prisma: PrismaClient;
  private isConnected = false;
  private createdIds: Map<string, Set<string>> = new Map();

  constructor() {
    this.prisma = new PrismaClient({
      log: process.env.DEBUG_TESTS ? ['query', 'error'] : ['error'],
    });
  }

  /**
   * Connect to test database
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    await this.prisma.$connect();
    this.isConnected = true;
  }

  /**
   * Disconnect from test database
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) return;

    await this.cleanup();
    await this.prisma.$disconnect();
    this.isConnected = false;
  }

  /**
   * Track created record for cleanup
   */
  trackRecord(table: string, id: string): void {
    if (!this.createdIds.has(table)) {
      this.createdIds.set(table, new Set());
    }
    this.createdIds.get(table)!.add(id);
  }

  /**
   * Clean up all tracked records
   */
  async cleanup(): Promise<void> {
    // Delete in reverse order of dependencies
    const deleteOrder = [
      'notification',
      'auditLog',
      'post',
      'platformConnection',
      'campaign',
      'project',
      'session',
      'user',
    ];

    for (const table of deleteOrder) {
      const ids = this.createdIds.get(table);
      if (ids && ids.size > 0) {
        try {
          await (this.prisma as any)[table].deleteMany({
            where: { id: { in: Array.from(ids) } },
          });
        } catch (error) {
          // Ignore deletion errors (records may already be deleted)
        }
      }
    }

    this.createdIds.clear();
  }

  /**
   * Reset database to clean state (for unit tests)
   */
  async reset(): Promise<void> {
    await this.cleanup();
  }

  /**
   * Execute raw SQL (for complex test setups)
   */
  async executeRaw(sql: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(sql);
  }

  /**
   * Create transaction for test isolation
   */
  async inTransaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn as any) as Promise<T>;
  }
}

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

/**
 * Factory for creating test data
 */
export class TestDataFactory {
  private prisma: PrismaClient;
  private testDb: TestDatabase;
  private sequence = 0;

  constructor(testDb: TestDatabase) {
    this.testDb = testDb;
    this.prisma = testDb.prisma;
  }

  /**
   * Generate unique ID suffix
   */
  private generateSuffix(): string {
    this.sequence++;
    return `${Date.now()}_${this.sequence}`;
  }

  /**
   * Create test user
   */
  async createUser(overrides: Partial<CreateUserInput> = {}): Promise<TestUser> {
    const suffix = this.generateSuffix();
    const userData = {
      email: `test-${suffix}@example.com`,
      password: 'hashed_password_123',
      name: `Test User ${suffix}`,
      authProvider: 'local',
      emailVerified: true,
      ...overrides,
    };

    const user = await this.prisma.user.create({ data: userData });
    this.testDb.trackRecord('user', user.id);
    return user as TestUser;
  }

  /**
   * Create test campaign
   */
  async createCampaign(
    userId: string,
    overrides: Partial<CreateCampaignInput> = {}
  ): Promise<TestCampaign> {
    const suffix = this.generateSuffix();
    const campaignData = {
      name: `Test Campaign ${suffix}`,
      description: 'Test campaign description',
      status: 'draft' as const,
      platform: 'twitter' as const,
      userId,
      ...overrides,
    };

    const campaign = await this.prisma.campaign.create({ data: campaignData });
    this.testDb.trackRecord('campaign', campaign.id);
    return campaign as TestCampaign;
  }

  /**
   * Create test post
   */
  async createPost(
    campaignId: string,
    overrides: Partial<CreatePostInput> = {}
  ): Promise<TestPost> {
    const suffix = this.generateSuffix();
    const postData = {
      content: `Test post content ${suffix}`,
      platform: 'twitter' as const,
      status: 'draft' as const,
      campaignId,
      ...overrides,
    };

    const post = await this.prisma.post.create({ data: postData });
    this.testDb.trackRecord('post', post.id);
    return post as TestPost;
  }

  /**
   * Create test project
   */
  async createProject(
    userId: string,
    overrides: Partial<CreateProjectInput> = {}
  ): Promise<TestProject> {
    const suffix = this.generateSuffix();
    const projectData = {
      name: `Test Project ${suffix}`,
      description: 'Test project description',
      type: 'marketing',
      userId,
      ...overrides,
    };

    const project = await this.prisma.project.create({ data: projectData });
    this.testDb.trackRecord('project', project.id);
    return project as TestProject;
  }

  /**
   * Create test quote
   */
  async createQuote(overrides: Partial<CreateQuoteInput> = {}): Promise<TestQuote> {
    const suffix = this.generateSuffix();
    const quoteData = {
      text: `Test quote text ${suffix}`,
      author: 'Test Author',
      category: 'inspirational',
      usageCount: 0,
      ...overrides,
    };

    const quote = await this.prisma.quote.create({ data: quoteData });
    this.testDb.trackRecord('quote', quote.id);
    return quote as TestQuote;
  }

  /**
   * Create test platform connection
   */
  async createPlatformConnection(
    userId: string,
    overrides: Partial<CreatePlatformConnectionInput> = {}
  ): Promise<TestPlatformConnection> {
    const suffix = this.generateSuffix();
    const connectionData = {
      platform: 'twitter',
      profileId: `profile_${suffix}`,
      profileName: `Test Account ${suffix}`,
      accessToken: `token_${suffix}`,
      isActive: true,
      userId,
      ...overrides,
    };

    const connection = await this.prisma.platformConnection.create({ data: connectionData });
    this.testDb.trackRecord('platformConnection', connection.id);
    return connection as TestPlatformConnection;
  }

  /**
   * Create complete test scenario
   * Creates user with campaigns, posts, and connections
   */
  async createFullScenario(): Promise<TestScenario> {
    const user = await this.createUser();
    const campaign = await this.createCampaign(user.id);
    const posts = [
      await this.createPost(campaign.id, { platform: 'twitter' }),
      await this.createPost(campaign.id, { platform: 'instagram' }),
    ];
    const connection = await this.createPlatformConnection(user.id);
    const project = await this.createProject(user.id);

    return {
      user,
      campaign,
      posts,
      connection,
      project,
    };
  }

  /**
   * Create multiple users
   */
  async createUsers(count: number): Promise<TestUser[]> {
    const users: TestUser[] = [];
    for (let i = 0; i < count; i++) {
      users.push(await this.createUser({ name: `User ${i + 1}` }));
    }
    return users;
  }

  /**
   * Create multiple campaigns for a user
   */
  async createCampaigns(userId: string, count: number): Promise<TestCampaign[]> {
    const campaigns: TestCampaign[] = [];
    for (let i = 0; i < count; i++) {
      campaigns.push(await this.createCampaign(userId, { name: `Campaign ${i + 1}` }));
    }
    return campaigns;
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  authProvider: string;
  emailVerified: boolean;
}

interface CreateCampaignInput {
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'archived';
  userId: string;
}

interface CreatePostInput {
  content: string;
  platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'tiktok';
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'archived';
  campaignId: string;
}

interface CreateProjectInput {
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  userId: string;
}

interface CreateQuoteInput {
  content: string;
  author?: string;
  aiGenerated: boolean;
  usageCount: number;
}

interface CreatePlatformConnectionInput {
  platform: 'twitter' | 'instagram' | 'facebook' | 'linkedin' | 'tiktok';
  accountId: string;
  accountName?: string;
  accessToken: string;
  isActive: boolean;
  userId: string;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  authProvider: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestPost {
  id: string;
  content: string;
  platform: string;
  status: string;
  campaignId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestProject {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  data?: unknown;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestQuote {
  id: string;
  text: string;
  author?: string | null;
  source?: string | null;
  category: string;
  tags: string[];
  isCustom: boolean;
  isPublic: boolean;
  language: string;
  usageCount: number;
  likeCount: number;
  shareCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestPlatformConnection {
  id: string;
  platform: string;
  profileId?: string | null;
  profileName?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  scope?: string | null;
  isActive: boolean;
  lastSync?: Date | null;
  metadata?: unknown;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TestScenario {
  user: TestUser;
  campaign: TestCampaign;
  posts: TestPost[];
  connection: TestPlatformConnection;
  project: TestProject;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Wait for database to be ready
 */
export async function waitForDatabase(
  prisma: PrismaClient,
  maxRetries: number = 10,
  delayMs: number = 500
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return false;
}

/**
 * Create a test database instance for use in tests
 */
export function createTestDatabase(): TestDatabase {
  return new TestDatabase();
}

/**
 * Create a test data factory
 */
export function createTestDataFactory(testDb: TestDatabase): TestDataFactory {
  return new TestDataFactory(testDb);
}

export default {
  TestDatabase,
  TestDataFactory,
  waitForDatabase,
  createTestDatabase,
  createTestDataFactory,
};
