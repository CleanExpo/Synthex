/**
 * Team Collaboration System
 * Comprehensive team management with roles, permissions, and collaboration features
 */

import { db } from '../lib/supabase.js';
import { redisService } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { emailService } from '../lib/email.js';
import { websocketService } from '../lib/websocket.js';

// Team Collaboration Configuration
const TEAM_CONFIG = {
  // Role definitions
  roles: {
    owner: {
      name: 'Owner',
      level: 100,
      permissions: ['*'], // All permissions
      maxMembers: 1,
      canManage: ['admin', 'manager', 'editor', 'viewer'],
      canDelete: true,
      canTransfer: true
    },
    admin: {
      name: 'Administrator',
      level: 90,
      permissions: [
        'manage_team', 'manage_content', 'manage_campaigns',
        'manage_analytics', 'manage_settings', 'manage_billing',
        'create_content', 'edit_content', 'delete_content',
        'view_analytics', 'export_data', 'manage_integrations'
      ],
      maxMembers: 5,
      canManage: ['manager', 'editor', 'viewer'],
      canDelete: true,
      canTransfer: false
    },
    manager: {
      name: 'Manager',
      level: 70,
      permissions: [
        'manage_content', 'manage_campaigns', 'create_content',
        'edit_content', 'delete_content', 'view_analytics',
        'export_data', 'manage_team_limited', 'approve_content'
      ],
      maxMembers: 10,
      canManage: ['editor', 'viewer'],
      canDelete: false,
      canTransfer: false
    },
    editor: {
      name: 'Editor',
      level: 50,
      permissions: [
        'create_content', 'edit_content', 'view_analytics',
        'submit_for_approval', 'manage_own_content',
        'collaborate', 'comment'
      ],
      maxMembers: 20,
      canManage: [],
      canDelete: false,
      canTransfer: false
    },
    viewer: {
      name: 'Viewer',
      level: 10,
      permissions: [
        'view_content', 'view_analytics', 'comment',
        'export_own_data'
      ],
      maxMembers: 50,
      canManage: [],
      canDelete: false,
      canTransfer: false
    },
    guest: {
      name: 'Guest',
      level: 0,
      permissions: ['view_public_content'],
      maxMembers: 100,
      canManage: [],
      canDelete: false,
      canTransfer: false
    }
  },
  
  // Team settings
  team: {
    maxTeamSize: 100,
    maxTeamsPerUser: 10,
    inviteExpiration: 7 * 24 * 60 * 60 * 1000, // 7 days
    activityTracking: true,
    auditLog: true
  },
  
  // Collaboration features
  collaboration: {
    realTimeSync: true,
    presenceTracking: true,
    versionControl: true,
    conflictResolution: 'last-write-wins',
    maxConcurrentEditors: 5,
    lockTimeout: 300000 // 5 minutes
  },
  
  // Notifications
  notifications: {
    enabled: true,
    channels: ['email', 'in-app', 'push'],
    events: [
      'member_invited', 'member_joined', 'member_left',
      'role_changed', 'content_shared', 'mention',
      'approval_required', 'approval_given'
    ]
  },
  
  // Activity tracking
  activity: {
    trackViews: true,
    trackEdits: true,
    trackComments: true,
    retentionDays: 90
  }
};

class TeamCollaborationSystem {
  constructor() {
    this.teams = new Map();
    this.activeCollaborations = new Map();
    this.presenceTracking = new Map();
    this.contentLocks = new Map();
    this.init();
  }

  async init() {
    logger.info('Initializing team collaboration system', { category: 'team' });
    
    // Load existing teams
    await this.loadTeams();
    
    // Start presence tracking
    if (TEAM_CONFIG.collaboration.presenceTracking) {
      this.startPresenceTracking();
    }
    
    // Initialize real-time sync
    if (TEAM_CONFIG.collaboration.realTimeSync) {
      this.initializeRealTimeSync();
    }
    
    // Start cleanup jobs
    this.startCleanupJobs();
    
    logger.info('Team collaboration system initialized', {
      category: 'team',
      teams: this.teams.size
    });
  }

  // Create a new team
  async createTeam(teamData) {
    const team = {
      id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: teamData.name,
      description: teamData.description,
      createdAt: new Date().toISOString(),
      createdBy: teamData.createdBy,
      
      // Team settings
      settings: {
        visibility: teamData.visibility || 'private', // private, internal, public
        joinPolicy: teamData.joinPolicy || 'invite', // invite, request, open
        contentSharing: teamData.contentSharing || 'team', // team, organization, public
        ...teamData.settings
      },
      
      // Members
      members: [{
        userId: teamData.createdBy,
        role: 'owner',
        joinedAt: new Date().toISOString(),
        permissions: TEAM_CONFIG.roles.owner.permissions,
        status: 'active'
      }],
      
      // Team resources
      resources: {
        projects: [],
        campaigns: [],
        templates: [],
        brandAssets: []
      },
      
      // Team stats
      stats: {
        totalMembers: 1,
        totalContent: 0,
        totalProjects: 0,
        storageUsed: 0
      }
    };

    try {
      // Validate team data
      await this.validateTeam(team);
      
      // Store in database
      const { error } = await db.supabase
        .from('teams')
        .insert({
          team_id: team.id,
          name: team.name,
          config: team,
          created_at: team.createdAt,
          created_by: team.createdBy
        });

      if (error) throw error;
      
      // Add to active teams
      this.teams.set(team.id, team);
      
      // Create default channels
      await this.createDefaultChannels(team.id);
      
      // Set up team workspace
      await this.setupTeamWorkspace(team);
      
      // Log activity
      await this.logActivity(team.id, 'team_created', {
        createdBy: team.createdBy,
        teamName: team.name
      });
      
      logger.info('Team created successfully', {
        category: 'team',
        teamId: team.id,
        name: team.name
      });
      
      return {
        success: true,
        team
      };
      
    } catch (error) {
      logger.error('Failed to create team', error, {
        category: 'team',
        teamName: team.name
      });
      throw error;
    }
  }

  // Add member to team
  async addMember(teamId, memberData) {
    try {
      const team = this.teams.get(teamId);
      if (!team) {
        throw new Error('Team not found');
      }
      
      // Check if member already exists
      if (team.members.find(m => m.userId === memberData.userId)) {
        throw new Error('User is already a team member');
      }
      
      // Validate role
      const role = TEAM_CONFIG.roles[memberData.role];
      if (!role) {
        throw new Error('Invalid role');
      }
      
      // Check role limits
      const roleMembers = team.members.filter(m => m.role === memberData.role);
      if (roleMembers.length >= role.maxMembers) {
        throw new Error(`Maximum ${role.maxMembers} ${role.name}s allowed`);
      }
      
      // Check team size limit
      if (team.members.length >= TEAM_CONFIG.team.maxTeamSize) {
        throw new Error('Team size limit reached');
      }
      
      // Create member object
      const member = {
        userId: memberData.userId,
        role: memberData.role,
        joinedAt: new Date().toISOString(),
        invitedBy: memberData.invitedBy,
        permissions: role.permissions,
        status: memberData.status || 'pending',
        customPermissions: memberData.customPermissions || []
      };
      
      // Add member to team
      team.members.push(member);
      team.stats.totalMembers++;
      
      // Update in database
      await this.updateTeam(teamId, team);
      
      // Send invitation if pending
      if (member.status === 'pending') {
        await this.sendInvitation(teamId, member);
      }
      
      // Notify team
      await this.notifyTeam(teamId, 'member_added', {
        member,
        addedBy: memberData.invitedBy
      });
      
      // Log activity
      await this.logActivity(teamId, 'member_added', {
        userId: member.userId,
        role: member.role,
        addedBy: memberData.invitedBy
      });
      
      return {
        success: true,
        member
      };
      
    } catch (error) {
      logger.error('Failed to add team member', error, {
        category: 'team',
        teamId,
        userId: memberData.userId
      });
      throw error;
    }
  }

  // Update member role
  async updateMemberRole(teamId, userId, newRole, updatedBy) {
    try {
      const team = this.teams.get(teamId);
      if (!team) {
        throw new Error('Team not found');
      }
      
      const member = team.members.find(m => m.userId === userId);
      if (!member) {
        throw new Error('Member not found');
      }
      
      const updater = team.members.find(m => m.userId === updatedBy);
      if (!updater) {
        throw new Error('Updater not found in team');
      }
      
      // Check permissions
      if (!this.canManageRole(updater.role, member.role, newRole)) {
        throw new Error('Insufficient permissions to update role');
      }
      
      // Update role
      const oldRole = member.role;
      member.role = newRole;
      member.permissions = TEAM_CONFIG.roles[newRole].permissions;
      member.updatedAt = new Date().toISOString();
      
      // Update in database
      await this.updateTeam(teamId, team);
      
      // Notify member
      await this.notifyMember(userId, 'role_changed', {
        teamId,
        oldRole,
        newRole,
        updatedBy
      });
      
      // Log activity
      await this.logActivity(teamId, 'role_changed', {
        userId,
        oldRole,
        newRole,
        updatedBy
      });
      
      return {
        success: true,
        member
      };
      
    } catch (error) {
      logger.error('Failed to update member role', error, {
        category: 'team',
        teamId,
        userId
      });
      throw error;
    }
  }

  // Remove member from team
  async removeMember(teamId, userId, removedBy) {
    try {
      const team = this.teams.get(teamId);
      if (!team) {
        throw new Error('Team not found');
      }
      
      const memberIndex = team.members.findIndex(m => m.userId === userId);
      if (memberIndex === -1) {
        throw new Error('Member not found');
      }
      
      const member = team.members[memberIndex];
      const remover = team.members.find(m => m.userId === removedBy);
      
      // Check permissions
      if (member.role === 'owner') {
        throw new Error('Cannot remove team owner');
      }
      
      if (!this.canRemoveMember(remover.role, member.role)) {
        throw new Error('Insufficient permissions to remove member');
      }
      
      // Remove member
      team.members.splice(memberIndex, 1);
      team.stats.totalMembers--;
      
      // Update in database
      await this.updateTeam(teamId, team);
      
      // Revoke access
      await this.revokeAccess(teamId, userId);
      
      // Notify member
      await this.notifyMember(userId, 'removed_from_team', {
        teamId,
        teamName: team.name,
        removedBy
      });
      
      // Log activity
      await this.logActivity(teamId, 'member_removed', {
        userId,
        removedBy
      });
      
      return {
        success: true,
        message: 'Member removed successfully'
      };
      
    } catch (error) {
      logger.error('Failed to remove team member', error, {
        category: 'team',
        teamId,
        userId
      });
      throw error;
    }
  }

  // Share content with team
  async shareContent(teamId, contentId, sharedBy, options = {}) {
    try {
      const team = this.teams.get(teamId);
      if (!team) {
        throw new Error('Team not found');
      }
      
      const sharer = team.members.find(m => m.userId === sharedBy);
      if (!sharer) {
        throw new Error('User not a team member');
      }
      
      // Check permissions
      if (!this.hasPermission(sharer, 'create_content')) {
        throw new Error('Insufficient permissions to share content');
      }
      
      // Create shared content entry
      const sharedContent = {
        contentId,
        teamId,
        sharedBy,
        sharedAt: new Date().toISOString(),
        permissions: options.permissions || ['view', 'comment'],
        expiresAt: options.expiresAt || null,
        notes: options.notes || ''
      };
      
      // Store in database
      await db.supabase
        .from('shared_content')
        .insert({
          content_id: contentId,
          team_id: teamId,
          shared_by: sharedBy,
          config: sharedContent,
          shared_at: sharedContent.sharedAt
        });
      
      // Add to team resources
      if (!team.resources.sharedContent) {
        team.resources.sharedContent = [];
      }
      team.resources.sharedContent.push(contentId);
      
      // Update team
      await this.updateTeam(teamId, team);
      
      // Notify team members
      await this.notifyTeam(teamId, 'content_shared', {
        contentId,
        sharedBy,
        notes: options.notes
      });
      
      // Start real-time collaboration if enabled
      if (TEAM_CONFIG.collaboration.realTimeSync && options.enableCollaboration) {
        await this.startCollaboration(teamId, contentId);
      }
      
      return {
        success: true,
        sharedContent
      };
      
    } catch (error) {
      logger.error('Failed to share content', error, {
        category: 'team',
        teamId,
        contentId
      });
      throw error;
    }
  }

  // Start real-time collaboration
  async startCollaboration(teamId, contentId) {
    try {
      const collaborationId = `collab_${teamId}_${contentId}`;
      
      if (this.activeCollaborations.has(collaborationId)) {
        return this.activeCollaborations.get(collaborationId);
      }
      
      const collaboration = {
        id: collaborationId,
        teamId,
        contentId,
        startedAt: new Date().toISOString(),
        participants: [],
        edits: [],
        locks: new Map(),
        version: 1
      };
      
      // Set up WebSocket channel
      if (websocketService) {
        const channel = `collaboration:${collaborationId}`;
        websocketService.createChannel(channel);
        
        // Handle collaboration events
        websocketService.on(channel, async (event) => {
          await this.handleCollaborationEvent(collaboration, event);
        });
      }
      
      // Store collaboration
      this.activeCollaborations.set(collaborationId, collaboration);
      
      logger.info('Collaboration started', {
        category: 'team',
        collaborationId,
        teamId,
        contentId
      });
      
      return collaboration;
      
    } catch (error) {
      logger.error('Failed to start collaboration', error, {
        category: 'team',
        teamId,
        contentId
      });
      throw error;
    }
  }

  // Handle collaboration event
  async handleCollaborationEvent(collaboration, event) {
    try {
      switch (event.type) {
        case 'join':
          await this.handleJoinCollaboration(collaboration, event.userId);
          break;
          
        case 'leave':
          await this.handleLeaveCollaboration(collaboration, event.userId);
          break;
          
        case 'edit':
          await this.handleCollaborativeEdit(collaboration, event);
          break;
          
        case 'lock':
          await this.handleContentLock(collaboration, event);
          break;
          
        case 'unlock':
          await this.handleContentUnlock(collaboration, event);
          break;
          
        case 'cursor':
          await this.handleCursorUpdate(collaboration, event);
          break;
          
        case 'comment':
          await this.handleComment(collaboration, event);
          break;
      }
      
      // Broadcast update to participants
      this.broadcastCollaborationUpdate(collaboration, event);
      
    } catch (error) {
      logger.error('Failed to handle collaboration event', error, {
        category: 'team',
        collaborationId: collaboration.id,
        eventType: event.type
      });
    }
  }

  // Track user presence
  async updatePresence(userId, teamId, status) {
    const presence = {
      userId,
      teamId,
      status, // online, away, busy, offline
      lastSeen: new Date().toISOString(),
      currentActivity: status.activity || null
    };
    
    // Update presence map
    const key = `${teamId}:${userId}`;
    this.presenceTracking.set(key, presence);
    
    // Broadcast to team
    if (websocketService) {
      websocketService.broadcast(`team:${teamId}:presence`, presence);
    }
    
    // Store in Redis for persistence
    if (redisService.isConnected) {
      await redisService.set(
        `presence:${key}`,
        JSON.stringify(presence),
        300 // 5 minute TTL
      );
    }
    
    return presence;
  }

  // Get team activity feed
  async getActivityFeed(teamId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      types = null,
      userId = null,
      dateFrom = null,
      dateTo = null
    } = options;
    
    try {
      let query = db.supabase
        .from('team_activity')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      if (types) {
        query = query.in('activity_type', types);
      }
      
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      if (dateFrom) {
        query = query.gte('created_at', dateFrom);
      }
      
      if (dateTo) {
        query = query.lte('created_at', dateTo);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Enrich activity data
      const enrichedActivities = await Promise.all(
        data.map(async (activity) => {
          const user = await this.getUser(activity.user_id);
          return {
            ...activity,
            user: {
              id: user.id,
              name: user.name,
              avatar: user.avatar
            }
          };
        })
      );
      
      return enrichedActivities;
      
    } catch (error) {
      logger.error('Failed to get activity feed', error, {
        category: 'team',
        teamId
      });
      return [];
    }
  }

  // Check user permission
  hasPermission(member, permission) {
    if (!member) return false;
    
    // Check wildcard permission
    if (member.permissions.includes('*')) return true;
    
    // Check specific permission
    if (member.permissions.includes(permission)) return true;
    
    // Check custom permissions
    if (member.customPermissions && member.customPermissions.includes(permission)) {
      return true;
    }
    
    return false;
  }

  // Check if user can manage another role
  canManageRole(managerRole, currentRole, newRole) {
    const manager = TEAM_CONFIG.roles[managerRole];
    const current = TEAM_CONFIG.roles[currentRole];
    const target = TEAM_CONFIG.roles[newRole];
    
    if (!manager || !current || !target) return false;
    
    // Check level hierarchy
    if (manager.level <= current.level) return false;
    if (manager.level <= target.level) return false;
    
    // Check management permissions
    return manager.canManage.includes(currentRole) && 
           manager.canManage.includes(newRole);
  }

  // Check if user can remove member
  canRemoveMember(removerRole, targetRole) {
    const remover = TEAM_CONFIG.roles[removerRole];
    const target = TEAM_CONFIG.roles[targetRole];
    
    if (!remover || !target) return false;
    
    // Check level hierarchy
    if (remover.level <= target.level) return false;
    
    // Check delete permission
    return remover.canDelete && remover.canManage.includes(targetRole);
  }

  // Utility methods
  async validateTeam(team) {
    if (!team.name || team.name.length < 3) {
      throw new Error('Team name must be at least 3 characters');
    }
    
    // Check for duplicate name
    const { data, error } = await db.supabase
      .from('teams')
      .select('team_id')
      .eq('name', team.name)
      .single();
    
    if (data) {
      throw new Error('Team name already exists');
    }
    
    return true;
  }

  async updateTeam(teamId, team) {
    team.updatedAt = new Date().toISOString();
    
    await db.supabase
      .from('teams')
      .update({
        config: team,
        updated_at: team.updatedAt
      })
      .eq('team_id', teamId);
    
    this.teams.set(teamId, team);
  }

  async loadTeams() {
    try {
      const { data, error } = await db.supabase
        .from('teams')
        .select('*')
        .eq('active', true);
      
      if (error) throw error;
      
      data?.forEach(team => {
        this.teams.set(team.team_id, team.config);
      });
      
    } catch (error) {
      logger.error('Failed to load teams', error, {
        category: 'team'
      });
    }
  }

  async createDefaultChannels(teamId) {
    // Create default communication channels
    const channels = ['general', 'random', 'announcements'];
    
    for (const channelName of channels) {
      await db.supabase
        .from('team_channels')
        .insert({
          team_id: teamId,
          name: channelName,
          type: channelName === 'announcements' ? 'announcement' : 'chat',
          created_at: new Date().toISOString()
        });
    }
  }

  async setupTeamWorkspace(team) {
    // Set up team-specific workspace settings
    const workspace = {
      teamId: team.id,
      folders: ['drafts', 'published', 'templates', 'archive'],
      tags: [],
      customFields: [],
      workflows: []
    };
    
    await db.supabase
      .from('team_workspaces')
      .insert({
        team_id: team.id,
        config: workspace,
        created_at: new Date().toISOString()
      });
  }

  async sendInvitation(teamId, member) {
    // Generate invitation token
    const token = this.generateInviteToken();
    
    // Store invitation
    await db.supabase
      .from('team_invitations')
      .insert({
        team_id: teamId,
        user_id: member.userId,
        token,
        role: member.role,
        expires_at: new Date(Date.now() + TEAM_CONFIG.team.inviteExpiration).toISOString(),
        created_at: new Date().toISOString()
      });
    
    // Send email
    const team = this.teams.get(teamId);
    const inviter = await this.getUser(member.invitedBy);
    
    await emailService.sendNotificationEmail(
      member.email,
      member.name,
      `Invitation to join ${team.name}`,
      `${inviter.name} has invited you to join the team "${team.name}" as a ${member.role}.`,
      `${process.env.APP_URL}/teams/join?token=${token}`
    );
  }

  async notifyTeam(teamId, event, data) {
    const team = this.teams.get(teamId);
    if (!team) return;
    
    // Send to all active team members
    for (const member of team.members) {
      if (member.status === 'active') {
        await this.notifyMember(member.userId, event, {
          teamId,
          teamName: team.name,
          ...data
        });
      }
    }
  }

  async notifyMember(userId, event, data) {
    // In-app notification
    await db.supabase
      .from('notifications')
      .insert({
        user_id: userId,
        type: event,
        data,
        created_at: new Date().toISOString(),
        read: false
      });
    
    // WebSocket notification
    if (websocketService) {
      websocketService.sendToUser(userId, {
        type: 'notification',
        event,
        data
      });
    }
  }

  async logActivity(teamId, activityType, metadata) {
    if (!TEAM_CONFIG.team.activityTracking) return;
    
    await db.supabase
      .from('team_activity')
      .insert({
        team_id: teamId,
        activity_type: activityType,
        metadata,
        created_at: new Date().toISOString()
      });
  }

  async revokeAccess(teamId, userId) {
    // Remove from shared content
    await db.supabase
      .from('shared_content')
      .delete()
      .eq('team_id', teamId)
      .eq('shared_by', userId);
    
    // Remove from active collaborations
    for (const [id, collaboration] of this.activeCollaborations) {
      if (collaboration.teamId === teamId) {
        const index = collaboration.participants.findIndex(p => p.userId === userId);
        if (index !== -1) {
          collaboration.participants.splice(index, 1);
        }
      }
    }
  }

  broadcastCollaborationUpdate(collaboration, event) {
    if (websocketService) {
      const channel = `collaboration:${collaboration.id}`;
      websocketService.broadcast(channel, {
        type: 'collaboration_update',
        event,
        collaboration: {
          id: collaboration.id,
          version: collaboration.version,
          participants: collaboration.participants,
          locks: Array.from(collaboration.locks.entries())
        }
      });
    }
  }

  startPresenceTracking() {
    setInterval(() => {
      this.cleanupOfflinePresence();
    }, 60000); // Every minute
  }

  cleanupOfflinePresence() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes
    
    for (const [key, presence] of this.presenceTracking) {
      const lastSeen = new Date(presence.lastSeen).getTime();
      if (now - lastSeen > timeout) {
        presence.status = 'offline';
        this.presenceTracking.set(key, presence);
      }
    }
  }

  initializeRealTimeSync() {
    // Set up real-time synchronization handlers
    logger.info('Real-time sync initialized', { category: 'team' });
  }

  startCleanupJobs() {
    // Clean up expired invitations
    setInterval(async () => {
      await db.supabase
        .from('team_invitations')
        .delete()
        .lt('expires_at', new Date().toISOString());
    }, 3600000); // Every hour
    
    // Clean up old activity logs
    setInterval(async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - TEAM_CONFIG.activity.retentionDays);
      
      await db.supabase
        .from('team_activity')
        .delete()
        .lt('created_at', cutoff.toISOString());
    }, 86400000); // Daily
  }

  generateInviteToken() {
    return Math.random().toString(36).substr(2) + Date.now().toString(36);
  }

  async getUser(userId) {
    // Fetch user details
    const { data, error } = await db.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    return data || { id: userId, name: 'Unknown User' };
  }

  // Placeholder methods for collaboration
  async handleJoinCollaboration(collaboration, userId) {
    collaboration.participants.push({ userId, joinedAt: new Date().toISOString() });
  }

  async handleLeaveCollaboration(collaboration, userId) {
    const index = collaboration.participants.findIndex(p => p.userId === userId);
    if (index !== -1) {
      collaboration.participants.splice(index, 1);
    }
  }

  async handleCollaborativeEdit(collaboration, event) {
    collaboration.edits.push(event);
    collaboration.version++;
  }

  async handleContentLock(collaboration, event) {
    collaboration.locks.set(event.section, {
      userId: event.userId,
      lockedAt: new Date().toISOString()
    });
  }

  async handleContentUnlock(collaboration, event) {
    collaboration.locks.delete(event.section);
  }

  async handleCursorUpdate(collaboration, event) {
    // Update cursor position for collaborative editing
  }

  async handleComment(collaboration, event) {
    // Handle collaborative comments
  }
}

// Create singleton instance
export const teamCollaboration = new TeamCollaborationSystem();

// Export convenience methods
export const {
  createTeam,
  addMember,
  updateMemberRole,
  removeMember,
  shareContent,
  startCollaboration,
  updatePresence,
  getActivityFeed
} = teamCollaboration;

export default teamCollaboration;