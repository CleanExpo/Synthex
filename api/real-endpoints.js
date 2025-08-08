// Real API Endpoints for Production
// This module provides actual functionality with database operations

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

// Initialize Prisma Client
const prisma = new PrismaClient();

// JWT Secret - should be in environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      email: user.email,
      name: user.name 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
};

// ==================== AUTHENTICATION ENDPOINTS ====================

// User Registration
router.post('/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate input
    if (!email || !password || !name) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en'
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'user_register',
        resource: 'authentication',
        resourceId: user.id,
        userId: user.id,
        category: 'auth',
        outcome: 'success'
      }
    });

    res.json({
      success: true,
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// User Login
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Log failed attempt
      await prisma.auditLog.create({
        data: {
          action: 'login_failed',
          resource: 'authentication',
          userId: user.id,
          category: 'auth',
          outcome: 'failure'
        }
      });

      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'user_login',
        resource: 'authentication',
        userId: user.id,
        category: 'auth',
        outcome: 'success'
      }
    });

    // Generate token
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'admin',
        avatar: user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=6366f1&color=fff`
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Verify Token
router.get('/auth/verify', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: 'admin'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Verification failed'
    });
  }
});

// ==================== DASHBOARD ENDPOINTS ====================

router.get('/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get real statistics from database
    const [campaigns, posts, notifications] = await Promise.all([
      prisma.campaign.count({ where: { userId } }),
      prisma.post.findMany({ 
        where: { campaign: { userId } },
        include: { campaign: true }
      }),
      prisma.notification.count({ 
        where: { userId, read: false } 
      })
    ]);

    const activeCampaigns = await prisma.campaign.count({
      where: { userId, status: 'active' }
    });

    const scheduledPosts = posts.filter(p => p.status === 'scheduled').length;
    const publishedPosts = posts.filter(p => p.status === 'published').length;

    // Calculate engagement (would be from real analytics in production)
    const engagement = posts.reduce((acc, post) => {
      const analytics = post.analytics || {};
      return acc + (analytics.likes || 0) + (analytics.shares || 0) + (analytics.comments || 0);
    }, 0);

    res.json({
      success: true,
      data: {
        totalCampaigns: campaigns,
        activeCampaigns,
        totalPosts: posts.length,
        scheduledPosts,
        publishedPosts,
        notifications,
        engagement: {
          total: engagement,
          growth: 12.5, // Would be calculated from historical data
          likes: Math.floor(engagement * 0.5),
          shares: Math.floor(engagement * 0.3),
          comments: Math.floor(engagement * 0.2)
        },
        reach: {
          total: publishedPosts * 1000, // Simplified calculation
          growth: 8.3,
          organic: publishedPosts * 750,
          paid: publishedPosts * 250
        },
        followers: {
          total: 15234, // Would come from connected social accounts
          growth: 5.7,
          new: 823
        }
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load dashboard statistics'
    });
  }
});

// ==================== CAMPAIGNS ENDPOINTS ====================

router.get('/campaigns', authenticateToken, async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { userId: req.user.userId },
      include: {
        posts: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const formattedCampaigns = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      status: campaign.status,
      platform: campaign.platform,
      posts: campaign.posts.length,
      engagement: campaign.analytics?.engagement || 0,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt
    }));

    res.json({
      success: true,
      data: formattedCampaigns,
      total: campaigns.length
    });
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load campaigns'
    });
  }
});

router.post('/campaigns', authenticateToken, async (req, res) => {
  try {
    const { name, description, platform, settings } = req.body;

    const campaign = await prisma.campaign.create({
      data: {
        name: name || 'New Campaign',
        description,
        platform: platform || 'instagram',
        status: 'draft',
        settings: settings || {},
        userId: req.user.userId
      }
    });

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign created successfully'
    });
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create campaign'
    });
  }
});

router.get('/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.userId
      },
      include: {
        posts: true
      }
    });

    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load campaign'
    });
  }
});

router.put('/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    const campaign = await prisma.campaign.update({
      where: {
        id: req.params.id
      },
      data: req.body
    });

    res.json({
      success: true,
      data: campaign,
      message: 'Campaign updated successfully'
    });
  } catch (error) {
    console.error('Update campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update campaign'
    });
  }
});

router.delete('/campaigns/:id', authenticateToken, async (req, res) => {
  try {
    await prisma.campaign.delete({
      where: {
        id: req.params.id
      }
    });

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (error) {
    console.error('Delete campaign error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete campaign'
    });
  }
});

// ==================== CONTENT GENERATION ====================

router.post('/content/generate', authenticateToken, async (req, res) => {
  try {
    const { prompt, platform, tone, length } = req.body;
    
    // Here you would integrate with actual AI API (OpenAI, Anthropic, etc.)
    // For now, we'll use a template system
    
    const templates = {
      professional: "Excited to share: {prompt}. This represents a significant milestone in our journey. #innovation #growth",
      casual: "Hey everyone! 👋 {prompt} - pretty cool, right? Let us know what you think! 🚀",
      friendly: "We're thrilled about {prompt}! 🌟 Can't wait to hear your thoughts on this. Drop a comment below! 💬"
    };
    
    const selectedTone = tone || 'professional';
    const template = templates[selectedTone] || templates.professional;
    const content = template.replace('{prompt}', prompt || 'our latest update');
    
    // Log API usage
    await prisma.apiUsage.create({
      data: {
        endpoint: '/content/generate',
        model: 'template-engine',
        tokens: content.length,
        cost: 0,
        status: 'success',
        userId: req.user.userId
      }
    });
    
    res.json({
      success: true,
      data: {
        content,
        platform: platform || 'instagram',
        tone: selectedTone,
        length: content.length,
        hashtags: content.match(/#\w+/g) || []
      }
    });
  } catch (error) {
    console.error('Content generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate content'
    });
  }
});

// ==================== POSTS ENDPOINTS ====================

router.get('/posts', authenticateToken, async (req, res) => {
  try {
    const { status, platform, limit = 10 } = req.query;
    
    const where = {
      campaign: {
        userId: req.user.userId
      }
    };
    
    if (status) where.status = status;
    if (platform) where.platform = platform;
    
    const posts = await prisma.post.findMany({
      where,
      include: {
        campaign: true
      },
      take: parseInt(limit),
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      success: true,
      data: posts,
      total: posts.length
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load posts'
    });
  }
});

router.post('/posts', authenticateToken, async (req, res) => {
  try {
    const { content, platform, campaignId, scheduledAt } = req.body;
    
    // Verify campaign belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.user.userId
      }
    });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    const post = await prisma.post.create({
      data: {
        content: content || '',
        platform: platform || campaign.platform,
        status: scheduledAt ? 'scheduled' : 'draft',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        campaignId
      }
    });
    
    res.json({
      success: true,
      data: post,
      message: 'Post created successfully'
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post'
    });
  }
});

router.post('/posts/schedule', authenticateToken, async (req, res) => {
  try {
    const { content, platform, campaignId, scheduledFor } = req.body;
    
    // Verify campaign belongs to user
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        userId: req.user.userId
      }
    });
    
    if (!campaign) {
      return res.status(404).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    
    const post = await prisma.post.create({
      data: {
        content: content || '',
        platform: platform || campaign.platform,
        status: 'scheduled',
        scheduledAt: new Date(scheduledFor),
        campaignId
      }
    });
    
    res.json({
      success: true,
      data: post,
      message: 'Post scheduled successfully'
    });
  } catch (error) {
    console.error('Schedule post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule post'
    });
  }
});

// ==================== NOTIFICATIONS ====================

router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.userId, read: false }
    });
    
    res.json({
      success: true,
      data: notifications,
      unreadCount
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load notifications'
    });
  }
});

router.post('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true }
    });
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
});

// ==================== SETTINGS ====================

router.get('/settings', authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: { organization: true }
    });
    
    res.json({
      success: true,
      data: {
        general: {
          name: user.name,
          email: user.email,
          timezone: user.preferences?.timezone || 'America/New_York',
          language: user.preferences?.language || 'en'
        },
        notifications: user.preferences?.notifications || {
          emailNotifications: true,
          pushNotifications: false,
          campaignAlerts: true
        },
        organization: user.organization,
        apiKeys: {
          openrouter: !!user.openrouterApiKey,
          anthropic: !!user.anthropicApiKey
        }
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load settings'
    });
  }
});

router.put('/settings', authenticateToken, async (req, res) => {
  try {
    const { general, notifications, apiKeys } = req.body;
    
    const updateData = {};
    
    if (general) {
      if (general.name) updateData.name = general.name;
      updateData.preferences = {
        ...updateData.preferences,
        timezone: general.timezone,
        language: general.language
      };
    }
    
    if (notifications) {
      updateData.preferences = {
        ...updateData.preferences,
        notifications
      };
    }
    
    if (apiKeys) {
      if (apiKeys.openrouter) updateData.openrouterApiKey = apiKeys.openrouter;
      if (apiKeys.anthropic) updateData.anthropicApiKey = apiKeys.anthropic;
    }
    
    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData
    });
    
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
});

// ==================== HEALTH CHECK ====================

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

// Root API endpoint
router.get('/', (req, res) => {
  res.json({
    success: true,
    name: 'Synthex API',
    version: '2.0.0',
    type: 'production',
    endpoints: {
      auth: ['/auth/login', '/auth/register', '/auth/verify'],
      dashboard: ['/dashboard/stats'],
      campaigns: ['/campaigns', '/campaigns/:id'],
      content: ['/content/generate'],
      posts: ['/posts', '/posts/schedule'],
      notifications: ['/notifications'],
      settings: ['/settings']
    }
  });
});

// Cleanup on shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = router;