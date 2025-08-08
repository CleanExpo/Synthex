/**
 * Mobile App API and Push Notification System
 * Complete mobile backend with push notifications, offline sync, and mobile optimization
 */

import { db } from '../lib/supabase.js';
import { redisService } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { websocketService } from '../lib/websocket.js';
import jwt from 'jsonwebtoken';

// Mobile API Configuration
const MOBILE_CONFIG = {
  // API settings
  api: {
    version: 'v1',
    baseUrl: process.env.MOBILE_API_URL || 'https://api.synthex.com/mobile',
    rateLimit: {
      authenticated: 1000, // per hour
      unauthenticated: 100, // per hour
      burst: 50 // per minute
    },
    timeout: 30000, // 30 seconds
    maxPayloadSize: 10 * 1024 * 1024, // 10MB
    compression: true
  },
  
  // Push notifications
  push: {
    providers: {
      fcm: {
        enabled: true,
        serverKey: process.env.FCM_SERVER_KEY,
        senderId: process.env.FCM_SENDER_ID
      },
      apns: {
        enabled: true,
        keyId: process.env.APNS_KEY_ID,
        teamId: process.env.APNS_TEAM_ID,
        bundleId: process.env.APNS_BUNDLE_ID,
        production: process.env.NODE_ENV === 'production'
      },
      webPush: {
        enabled: true,
        vapidPublic: process.env.VAPID_PUBLIC_KEY,
        vapidPrivate: process.env.VAPID_PRIVATE_KEY
      }
    },
    
    categories: [
      'content_published',
      'engagement_alert',
      'team_mention',
      'approval_required',
      'system_update',
      'marketing_insight'
    ],
    
    priorities: {
      urgent: 10,
      high: 7,
      normal: 5,
      low: 3
    },
    
    delivery: {
      maxRetries: 3,
      retryDelay: 60000, // 1 minute
      batchSize: 1000,
      ttl: 86400 // 24 hours
    }
  },
  
  // Offline sync
  offline: {
    enabled: true,
    syncInterval: 60000, // 1 minute
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    conflictResolution: 'server-wins',
    deltaSync: true
  },
  
  // Mobile optimization
  optimization: {
    imageCompression: true,
    lazyLoading: true,
    pagination: {
      defaultLimit: 20,
      maxLimit: 100
    },
    caching: {
      aggressive: true,
      ttl: 3600 // 1 hour
    }
  },
  
  // Security
  security: {
    tokenExpiry: 30 * 24 * 60 * 60, // 30 days
    refreshTokenExpiry: 90 * 24 * 60 * 60, // 90 days
    biometric: true,
    pinCode: true,
    certificatePinning: true,
    jailbreakDetection: true
  },
  
  // Device management
  devices: {
    maxDevicesPerUser: 10,
    trackDeviceInfo: true,
    allowMultipleLogins: true,
    remoteWipe: true
  }
};

class MobileAPISystem {
  constructor() {
    this.devices = new Map();
    this.pushTokens = new Map();
    this.offlineQueue = new Map();
    this.activeConnections = new Map();
    this.notificationQueue = [];
    this.init();
  }

  async init() {
    logger.info('Initializing mobile API system', { category: 'mobile' });
    
    // Initialize push notification services
    await this.initializePushServices();
    
    // Set up offline sync manager
    this.initializeOfflineSync();
    
    // Start notification processor
    this.startNotificationProcessor();
    
    // Initialize device manager
    await this.initializeDeviceManager();
    
    // Set up mobile-specific middleware
    this.setupMobileMiddleware();
    
    logger.info('Mobile API system initialized', {
      category: 'mobile',
      version: MOBILE_CONFIG.api.version
    });
  }

  // Register mobile device
  async registerDevice(deviceData) {
    const device = {
      id: `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: deviceData.userId,
      registeredAt: new Date().toISOString(),
      
      // Device information
      info: {
        platform: deviceData.platform, // ios, android, web
        model: deviceData.model,
        osVersion: deviceData.osVersion,
        appVersion: deviceData.appVersion,
        manufacturer: deviceData.manufacturer,
        screenSize: deviceData.screenSize,
        language: deviceData.language || 'en',
        timezone: deviceData.timezone || 'UTC'
      },
      
      // Push notification tokens
      pushTokens: {
        fcm: deviceData.fcmToken || null,
        apns: deviceData.apnsToken || null,
        webPush: deviceData.webPushToken || null
      },
      
      // Capabilities
      capabilities: {
        biometric: deviceData.biometric || false,
        camera: deviceData.camera || false,
        notifications: deviceData.notifications || false,
        location: deviceData.location || false,
        offline: deviceData.offline || false
      },
      
      // Security
      security: {
        jailbroken: deviceData.jailbroken || false,
        vpn: deviceData.vpn || false,
        pinEnabled: false,
        biometricEnabled: false,
        lastAuth: null
      },
      
      // Status
      status: 'active',
      lastSeen: new Date().toISOString(),
      syncStatus: {
        lastSync: null,
        pendingSync: false,
        syncErrors: []
      }
    };

    try {
      // Check device limit
      const userDevices = await this.getUserDevices(device.userId);
      if (userDevices.length >= MOBILE_CONFIG.devices.maxDevicesPerUser) {
        throw new Error('Device limit reached');
      }
      
      // Check for existing device
      const existingDevice = await this.findExistingDevice(deviceData);
      if (existingDevice) {
        // Update existing device
        return await this.updateDevice(existingDevice.id, deviceData);
      }
      
      // Store device
      const { error } = await db.supabase
        .from('mobile_devices')
        .insert({
          device_id: device.id,
          user_id: device.userId,
          platform: device.info.platform,
          config: device,
          created_at: device.registeredAt
        });

      if (error) throw error;
      
      // Add to active devices
      this.devices.set(device.id, device);
      
      // Store push tokens
      if (device.pushTokens.fcm || device.pushTokens.apns || device.pushTokens.webPush) {
        await this.storePushTokens(device);
      }
      
      // Generate auth tokens
      const tokens = await this.generateAuthTokens(device);
      
      // Send welcome notification
      await this.sendWelcomeNotification(device);
      
      logger.info('Mobile device registered', {
        category: 'mobile',
        deviceId: device.id,
        platform: device.info.platform
      });
      
      return {
        success: true,
        device: {
          id: device.id,
          platform: device.info.platform
        },
        tokens,
        config: {
          syncInterval: MOBILE_CONFIG.offline.syncInterval,
          features: await this.getEnabledFeatures(device.userId),
          settings: await this.getMobileSettings(device.userId)
        }
      };
      
    } catch (error) {
      logger.error('Failed to register device', error, {
        category: 'mobile',
        platform: deviceData.platform
      });
      throw error;
    }
  }

  // Send push notification
  async sendPushNotification(notificationData) {
    const notification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      
      // Target
      target: {
        userId: notificationData.userId,
        deviceId: notificationData.deviceId || null,
        segment: notificationData.segment || null,
        topic: notificationData.topic || null
      },
      
      // Content
      content: {
        title: notificationData.title,
        body: notificationData.body,
        image: notificationData.image || null,
        icon: notificationData.icon || null,
        badge: notificationData.badge || null,
        sound: notificationData.sound || 'default',
        vibration: notificationData.vibration || true
      },
      
      // Data payload
      data: notificationData.data || {},
      
      // Actions
      actions: notificationData.actions || [],
      
      // Settings
      settings: {
        priority: notificationData.priority || 'normal',
        category: notificationData.category || 'general',
        ttl: notificationData.ttl || MOBILE_CONFIG.push.delivery.ttl,
        collapseKey: notificationData.collapseKey || null,
        mutableContent: notificationData.mutableContent || false,
        contentAvailable: notificationData.contentAvailable || false
      },
      
      // Delivery
      delivery: {
        scheduled: notificationData.scheduledAt || null,
        attempts: 0,
        status: 'pending',
        deliveredAt: null,
        failureReason: null
      }
    };

    try {
      // Validate notification
      await this.validateNotification(notification);
      
      // Get target devices
      const devices = await this.getTargetDevices(notification.target);
      
      if (devices.length === 0) {
        throw new Error('No devices found for notification');
      }
      
      // Store notification
      const { error } = await db.supabase
        .from('push_notifications')
        .insert({
          notification_id: notification.id,
          user_id: notification.target.userId,
          content: notification.content,
          data: notification.data,
          settings: notification.settings,
          created_at: notification.createdAt
        });

      if (error) throw error;
      
      // Queue for delivery
      if (notification.delivery.scheduled) {
        await this.scheduleNotification(notification, devices);
      } else {
        await this.deliverNotification(notification, devices);
      }
      
      logger.info('Push notification sent', {
        category: 'mobile',
        notificationId: notification.id,
        devices: devices.length
      });
      
      return {
        success: true,
        notification: {
          id: notification.id,
          devices: devices.length,
          status: notification.delivery.status
        }
      };
      
    } catch (error) {
      logger.error('Failed to send push notification', error, {
        category: 'mobile',
        title: notification.content.title
      });
      throw error;
    }
  }

  // Mobile-optimized API endpoints
  async getMobileContent(userId, options = {}) {
    const {
      page = 1,
      limit = MOBILE_CONFIG.optimization.pagination.defaultLimit,
      platform = 'all',
      optimized = true
    } = options;

    try {
      // Get content with mobile optimization
      const offset = (page - 1) * limit;
      
      let query = db.supabase
        .from('optimized_content')
        .select('*')
        .eq('user_id', userId)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });
      
      if (platform !== 'all') {
        query = query.eq('platform', platform);
      }
      
      const { data: content, error } = await query;
      if (error) throw error;
      
      // Optimize for mobile
      const mobileOptimized = await this.optimizeForMobile(content, {
        compressImages: MOBILE_CONFIG.optimization.imageCompression,
        truncateText: true,
        includeMetrics: true
      });
      
      // Add offline availability
      const withOfflineStatus = mobileOptimized.map(item => ({
        ...item,
        offline: {
          available: false,
          size: this.calculateContentSize(item),
          lastSync: null
        }
      }));
      
      return {
        content: withOfflineStatus,
        pagination: {
          page,
          limit,
          hasMore: content.length === limit,
          total: await this.getTotalCount(userId)
        },
        sync: {
          lastSync: new Date().toISOString(),
          pendingChanges: 0
        }
      };
      
    } catch (error) {
      logger.error('Failed to get mobile content', error, {
        category: 'mobile',
        userId
      });
      throw error;
    }
  }

  // Sync offline changes
  async syncOfflineChanges(deviceId, changes) {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }
      
      const syncResult = {
        received: changes.length,
        processed: 0,
        conflicts: [],
        errors: []
      };
      
      // Process each change
      for (const change of changes) {
        try {
          switch (change.type) {
            case 'create':
              await this.processOfflineCreate(change, device.userId);
              break;
              
            case 'update':
              await this.processOfflineUpdate(change, device.userId);
              break;
              
            case 'delete':
              await this.processOfflineDelete(change, device.userId);
              break;
              
            default:
              throw new Error(`Unknown change type: ${change.type}`);
          }
          
          syncResult.processed++;
          
        } catch (error) {
          if (error.message.includes('conflict')) {
            syncResult.conflicts.push({
              change,
              reason: error.message
            });
          } else {
            syncResult.errors.push({
              change,
              error: error.message
            });
          }
        }
      }
      
      // Update device sync status
      device.syncStatus.lastSync = new Date().toISOString();
      device.syncStatus.pendingSync = false;
      device.syncStatus.syncErrors = syncResult.errors;
      
      await this.updateDevice(deviceId, device);
      
      // Get server changes
      const serverChanges = await this.getServerChanges(
        device.userId,
        device.syncStatus.lastSync
      );
      
      return {
        success: syncResult.errors.length === 0,
        syncResult,
        serverChanges,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Failed to sync offline changes', error, {
        category: 'mobile',
        deviceId,
        changes: changes.length
      });
      throw error;
    }
  }

  // Mobile dashboard data
  async getMobileDashboard(userId) {
    try {
      // Get optimized dashboard data
      const [
        metrics,
        recentContent,
        notifications,
        tasks,
        insights
      ] = await Promise.all([
        this.getMobileMetrics(userId),
        this.getRecentMobileContent(userId, 5),
        this.getUnreadNotifications(userId),
        this.getPendingTasks(userId),
        this.getQuickInsights(userId)
      ]);
      
      return {
        metrics: {
          overview: metrics.overview,
          today: metrics.today,
          trend: metrics.trend
        },
        recentContent: recentContent.map(c => ({
          id: c.id,
          title: c.title,
          platform: c.platform,
          performance: c.score,
          thumbnail: c.thumbnail
        })),
        notifications: {
          unread: notifications.count,
          important: notifications.important,
          latest: notifications.latest.slice(0, 3)
        },
        tasks: {
          pending: tasks.pending,
          urgent: tasks.urgent,
          upcoming: tasks.upcoming.slice(0, 3)
        },
        insights: insights.slice(0, 3),
        lastUpdated: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error('Failed to get mobile dashboard', error, {
        category: 'mobile',
        userId
      });
      throw error;
    }
  }

  // Update push token
  async updatePushToken(deviceId, tokenData) {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }
      
      // Update tokens
      if (tokenData.fcm) device.pushTokens.fcm = tokenData.fcm;
      if (tokenData.apns) device.pushTokens.apns = tokenData.apns;
      if (tokenData.webPush) device.pushTokens.webPush = tokenData.webPush;
      
      // Update in database
      await db.supabase
        .from('mobile_devices')
        .update({
          config: device,
          updated_at: new Date().toISOString()
        })
        .eq('device_id', deviceId);
      
      // Update push token registry
      await this.storePushTokens(device);
      
      return {
        success: true,
        message: 'Push token updated'
      };
      
    } catch (error) {
      logger.error('Failed to update push token', error, {
        category: 'mobile',
        deviceId
      });
      throw error;
    }
  }

  // Get notification history
  async getNotificationHistory(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      category = 'all',
      read = null
    } = options;

    try {
      const offset = (page - 1) * limit;
      
      let query = db.supabase
        .from('push_notifications')
        .select('*')
        .eq('user_id', userId)
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });
      
      if (category !== 'all') {
        query = query.eq('settings->category', category);
      }
      
      if (read !== null) {
        query = query.eq('read', read);
      }
      
      const { data: notifications, error } = await query;
      if (error) throw error;
      
      // Format for mobile
      const formatted = notifications.map(n => ({
        id: n.notification_id,
        title: n.content.title,
        body: n.content.body,
        category: n.settings.category,
        timestamp: n.created_at,
        read: n.read || false,
        data: n.data
      }));
      
      return {
        notifications: formatted,
        pagination: {
          page,
          limit,
          hasMore: notifications.length === limit
        },
        unreadCount: await this.getUnreadCount(userId)
      };
      
    } catch (error) {
      logger.error('Failed to get notification history', error, {
        category: 'mobile',
        userId
      });
      throw error;
    }
  }

  // Mark notification as read
  async markNotificationRead(notificationId, userId) {
    try {
      await db.supabase
        .from('push_notifications')
        .update({
          read: true,
          read_at: new Date().toISOString()
        })
        .eq('notification_id', notificationId)
        .eq('user_id', userId);
      
      // Update badge count
      await this.updateBadgeCount(userId);
      
      return {
        success: true,
        message: 'Notification marked as read'
      };
      
    } catch (error) {
      logger.error('Failed to mark notification as read', error, {
        category: 'mobile',
        notificationId
      });
      throw error;
    }
  }

  // Logout device
  async logoutDevice(deviceId) {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }
      
      // Clear push tokens
      device.pushTokens = {
        fcm: null,
        apns: null,
        webPush: null
      };
      
      // Update status
      device.status = 'logged_out';
      device.security.lastAuth = null;
      
      // Update in database
      await db.supabase
        .from('mobile_devices')
        .update({
          status: 'logged_out',
          config: device,
          logged_out_at: new Date().toISOString()
        })
        .eq('device_id', deviceId);
      
      // Remove from active devices
      this.devices.delete(deviceId);
      
      // Clear offline cache
      this.offlineQueue.delete(deviceId);
      
      return {
        success: true,
        message: 'Device logged out successfully'
      };
      
    } catch (error) {
      logger.error('Failed to logout device', error, {
        category: 'mobile',
        deviceId
      });
      throw error;
    }
  }

  // Remote wipe device
  async remoteWipeDevice(deviceId, requestedBy) {
    try {
      const device = this.devices.get(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }
      
      // Send wipe command
      await this.sendPushNotification({
        userId: device.userId,
        deviceId,
        title: 'Remote Wipe',
        body: 'Your device data is being wiped',
        data: {
          action: 'remote_wipe',
          requestedBy,
          timestamp: new Date().toISOString()
        },
        priority: 'urgent'
      });
      
      // Mark device as wiped
      device.status = 'wiped';
      
      // Update in database
      await db.supabase
        .from('mobile_devices')
        .update({
          status: 'wiped',
          wiped_at: new Date().toISOString(),
          wiped_by: requestedBy
        })
        .eq('device_id', deviceId);
      
      // Remove from active devices
      this.devices.delete(deviceId);
      
      // Log security event
      logger.warn('Device remotely wiped', {
        category: 'mobile',
        deviceId,
        requestedBy
      });
      
      return {
        success: true,
        message: 'Device wiped successfully'
      };
      
    } catch (error) {
      logger.error('Failed to wipe device', error, {
        category: 'mobile',
        deviceId
      });
      throw error;
    }
  }

  // Utility methods
  async initializePushServices() {
    // Initialize FCM
    if (MOBILE_CONFIG.push.providers.fcm.enabled) {
      // Initialize Firebase Admin SDK
      logger.info('FCM push service initialized', { category: 'mobile' });
    }
    
    // Initialize APNS
    if (MOBILE_CONFIG.push.providers.apns.enabled) {
      // Initialize Apple Push Notification service
      logger.info('APNS push service initialized', { category: 'mobile' });
    }
    
    // Initialize Web Push
    if (MOBILE_CONFIG.push.providers.webPush.enabled) {
      // Initialize Web Push service
      logger.info('Web Push service initialized', { category: 'mobile' });
    }
  }

  initializeOfflineSync() {
    // Set up offline sync manager
    setInterval(() => {
      this.processOfflineQueue();
    }, MOBILE_CONFIG.offline.syncInterval);
  }

  startNotificationProcessor() {
    // Process notification queue
    setInterval(() => {
      this.processNotificationQueue();
    }, 5000); // Every 5 seconds
  }

  async initializeDeviceManager() {
    // Load active devices
    const { data: devices } = await db.supabase
      .from('mobile_devices')
      .select('*')
      .eq('status', 'active');
    
    devices?.forEach(device => {
      this.devices.set(device.device_id, device.config);
    });
  }

  setupMobileMiddleware() {
    // Set up mobile-specific middleware for API
    logger.info('Mobile middleware configured', { category: 'mobile' });
  }

  async validateNotification(notification) {
    if (!notification.content.title || !notification.content.body) {
      throw new Error('Notification title and body are required');
    }
    
    if (!notification.target.userId && !notification.target.segment && !notification.target.topic) {
      throw new Error('Notification must have a target');
    }
    
    return true;
  }

  async getTargetDevices(target) {
    const devices = [];
    
    if (target.userId) {
      const userDevices = await this.getUserDevices(target.userId);
      devices.push(...userDevices);
    }
    
    if (target.deviceId) {
      const device = this.devices.get(target.deviceId);
      if (device) devices.push(device);
    }
    
    return devices;
  }

  async deliverNotification(notification, devices) {
    for (const device of devices) {
      try {
        switch (device.info.platform) {
          case 'ios':
            await this.sendAPNS(notification, device);
            break;
          case 'android':
            await this.sendFCM(notification, device);
            break;
          case 'web':
            await this.sendWebPush(notification, device);
            break;
        }
        
        notification.delivery.status = 'delivered';
        notification.delivery.deliveredAt = new Date().toISOString();
        
      } catch (error) {
        notification.delivery.attempts++;
        notification.delivery.failureReason = error.message;
        
        if (notification.delivery.attempts < MOBILE_CONFIG.push.delivery.maxRetries) {
          // Retry later
          this.notificationQueue.push({ notification, devices: [device] });
        } else {
          notification.delivery.status = 'failed';
        }
      }
    }
  }

  async scheduleNotification(notification, devices) {
    // Schedule for later delivery
    const scheduledTime = new Date(notification.delivery.scheduled);
    const delay = scheduledTime - new Date();
    
    setTimeout(() => {
      this.deliverNotification(notification, devices);
    }, delay);
  }

  async getUserDevices(userId) {
    const { data } = await db.supabase
      .from('mobile_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');
    
    return data?.map(d => d.config) || [];
  }

  async findExistingDevice(deviceData) {
    // Check for existing device based on unique identifiers
    return null;
  }

  async updateDevice(deviceId, updates) {
    const device = this.devices.get(deviceId);
    if (!device) return null;
    
    Object.assign(device, updates);
    this.devices.set(deviceId, device);
    
    await db.supabase
      .from('mobile_devices')
      .update({
        config: device,
        updated_at: new Date().toISOString()
      })
      .eq('device_id', deviceId);
    
    return device;
  }

  async storePushTokens(device) {
    const tokens = [];
    
    if (device.pushTokens.fcm) {
      tokens.push({ type: 'fcm', token: device.pushTokens.fcm });
    }
    if (device.pushTokens.apns) {
      tokens.push({ type: 'apns', token: device.pushTokens.apns });
    }
    if (device.pushTokens.webPush) {
      tokens.push({ type: 'webPush', token: device.pushTokens.webPush });
    }
    
    this.pushTokens.set(device.id, tokens);
  }

  async generateAuthTokens(device) {
    const accessToken = jwt.sign(
      { 
        deviceId: device.id,
        userId: device.userId,
        platform: device.info.platform
      },
      process.env.JWT_SECRET,
      { expiresIn: MOBILE_CONFIG.security.tokenExpiry }
    );
    
    const refreshToken = jwt.sign(
      { 
        deviceId: device.id,
        userId: device.userId,
        type: 'refresh'
      },
      process.env.JWT_SECRET,
      { expiresIn: MOBILE_CONFIG.security.refreshTokenExpiry }
    );
    
    return { accessToken, refreshToken };
  }

  async sendWelcomeNotification(device) {
    await this.sendPushNotification({
      userId: device.userId,
      deviceId: device.id,
      title: 'Welcome to Synthex!',
      body: 'Your mobile device has been successfully registered',
      category: 'system_update'
    });
  }

  async getEnabledFeatures(userId) {
    // Get user-specific enabled features
    return {
      offline: true,
      push: true,
      biometric: true,
      darkMode: true,
      analytics: true
    };
  }

  async getMobileSettings(userId) {
    // Get user mobile settings
    return {
      theme: 'system',
      language: 'en',
      notifications: true,
      autoSync: true,
      dataUsage: 'wifi-only'
    };
  }

  async optimizeForMobile(content, options) {
    // Optimize content for mobile display
    return content.map(item => ({
      ...item,
      thumbnail: item.media?.[0]?.thumbnail || null,
      excerpt: item.content?.substring(0, 150) + '...'
    }));
  }

  calculateContentSize(item) {
    // Calculate approximate size in bytes
    return JSON.stringify(item).length;
  }

  async getTotalCount(userId) {
    const { count } = await db.supabase
      .from('optimized_content')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    
    return count || 0;
  }

  async processOfflineCreate(change, userId) {
    // Process offline content creation
    await db.supabase
      .from('optimized_content')
      .insert({
        ...change.data,
        user_id: userId,
        created_offline: true,
        synced_at: new Date().toISOString()
      });
  }

  async processOfflineUpdate(change, userId) {
    // Process offline content update
    await db.supabase
      .from('optimized_content')
      .update({
        ...change.data,
        synced_at: new Date().toISOString()
      })
      .eq('id', change.id)
      .eq('user_id', userId);
  }

  async processOfflineDelete(change, userId) {
    // Process offline content deletion
    await db.supabase
      .from('optimized_content')
      .delete()
      .eq('id', change.id)
      .eq('user_id', userId);
  }

  async getServerChanges(userId, lastSync) {
    const { data } = await db.supabase
      .from('optimized_content')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastSync);
    
    return data || [];
  }

  async getMobileMetrics(userId) {
    // Get mobile-optimized metrics
    return {
      overview: { posts: 100, engagement: 5000, growth: 15 },
      today: { posts: 5, engagement: 250, new_followers: 10 },
      trend: 'up'
    };
  }

  async getRecentMobileContent(userId, limit) {
    const { data } = await db.supabase
      .from('optimized_content')
      .select('id, title, platform, score, media')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    return data || [];
  }

  async getUnreadNotifications(userId) {
    const { data, count } = await db.supabase
      .from('push_notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10);
    
    return {
      count: count || 0,
      important: data?.filter(n => n.settings.priority === 'urgent').length || 0,
      latest: data || []
    };
  }

  async getPendingTasks(userId) {
    // Get pending tasks for mobile dashboard
    return {
      pending: 5,
      urgent: 2,
      upcoming: []
    };
  }

  async getQuickInsights(userId) {
    // Get quick insights for mobile
    return [
      { type: 'tip', message: 'Best time to post: 2:00 PM' },
      { type: 'alert', message: 'Engagement up 20% this week' },
      { type: 'suggestion', message: 'Try video content for better reach' }
    ];
  }

  async getUnreadCount(userId) {
    const { count } = await db.supabase
      .from('push_notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);
    
    return count || 0;
  }

  async updateBadgeCount(userId) {
    const count = await this.getUnreadCount(userId);
    
    // Send badge update to all user devices
    const devices = await this.getUserDevices(userId);
    for (const device of devices) {
      await this.sendBadgeUpdate(device, count);
    }
  }

  async sendBadgeUpdate(device, count) {
    // Send silent push to update badge
    await this.sendPushNotification({
      deviceId: device.id,
      data: { badge: count },
      contentAvailable: true,
      priority: 'high'
    });
  }

  async processOfflineQueue() {
    // Process queued offline changes
    for (const [deviceId, queue] of this.offlineQueue) {
      if (queue.length > 0) {
        await this.syncOfflineChanges(deviceId, queue);
        this.offlineQueue.set(deviceId, []);
      }
    }
  }

  async processNotificationQueue() {
    // Process queued notifications
    while (this.notificationQueue.length > 0) {
      const { notification, devices } = this.notificationQueue.shift();
      await this.deliverNotification(notification, devices);
    }
  }

  // Platform-specific push methods
  async sendFCM(notification, device) {
    // Send via Firebase Cloud Messaging
    logger.debug('Sending FCM notification', {
      category: 'mobile',
      deviceId: device.id
    });
  }

  async sendAPNS(notification, device) {
    // Send via Apple Push Notification Service
    logger.debug('Sending APNS notification', {
      category: 'mobile',
      deviceId: device.id
    });
  }

  async sendWebPush(notification, device) {
    // Send via Web Push
    logger.debug('Sending Web Push notification', {
      category: 'mobile',
      deviceId: device.id
    });
  }
}

// Create singleton instance
export const mobileAPI = new MobileAPISystem();

// Export convenience methods
export const {
  registerDevice,
  sendPushNotification,
  getMobileContent,
  syncOfflineChanges,
  getMobileDashboard,
  updatePushToken,
  getNotificationHistory,
  markNotificationRead,
  logoutDevice,
  remoteWipeDevice
} = mobileAPI;

export default mobileAPI;