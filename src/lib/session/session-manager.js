/**
 * SYNTHEX Session Manager
 * Implements session persistence using Claude Code SDK capabilities
 * Maintains user state, preferences, and work progress across sessions
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

class SessionManager {
  constructor() {
    this.sessionDir = '.claude-session';
    this.sessionFile = path.join(this.sessionDir, 'synthex-session.json');
    this.historyFile = path.join(this.sessionDir, 'history.log');
    this.backupDir = path.join(this.sessionDir, 'backups');
    this.agentDir = path.join(this.sessionDir, 'agents');
    this.currentSession = null;
    this.autoSaveInterval = null;
    this.operationCount = 0;
  }

  /**
   * Initialize session management system
   */
  async initialize() {
    try {
      // Create directory structure
      await this.ensureDirectories();
      
      // Load or create session
      this.currentSession = await this.loadOrCreateSession();
      
      // Start auto-save mechanism
      this.startAutoSave();
      
      // Log session start
      await this.logEvent('SESSION_START', {
        sessionId: this.currentSession.id,
        timestamp: new Date().toISOString()
      });
      
      return this.currentSession;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      throw error;
    }
  }

  /**
   * Ensure all required directories exist
   */
  async ensureDirectories() {
    const dirs = [
      this.sessionDir,
      this.backupDir,
      this.agentDir,
      path.join(this.agentDir, 'marketing'),
      path.join(this.agentDir, 'ux-design'),
      path.join(this.agentDir, 'development'),
      path.join(this.agentDir, 'deployment')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Load existing session or create new one
   */
  async loadOrCreateSession() {
    try {
      const sessionData = await fs.readFile(this.sessionFile, 'utf-8');
      const session = JSON.parse(sessionData);
      
      // Validate session integrity
      if (this.validateSession(session)) {
        session.resumed = true;
        session.resumedAt = new Date().toISOString();
        return session;
      }
    } catch (error) {
      // Session doesn't exist or is corrupted
      console.log('Creating new session...');
    }

    // Create new session
    return this.createNewSession();
  }

  /**
   * Create a new session with default structure
   */
  createNewSession() {
    return {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      version: '1.2.0',
      project: 'SYNTHEX',
      environment: process.env.NODE_ENV || 'development',
      
      // User preferences
      preferences: {
        outputStyle: 'default',
        theme: 'dark',
        autoSave: true,
        verbosity: 'normal',
        mcpConfigs: ['mcp.config.json']
      },
      
      // Work state
      workState: {
        currentTask: null,
        completedTasks: [],
        pendingTasks: [],
        currentBranch: 'main',
        lastDeployment: null,
        activeAgents: []
      },
      
      // Performance metrics
      metrics: {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        averageResponseTime: 0,
        resourceUsage: {
          cpu: [],
          memory: []
        }
      },
      
      // Marketing campaign data
      marketingData: {
        campaigns: [],
        contentQueue: [],
        analytics: {},
        abTests: []
      },
      
      // Error tracking
      errors: [],
      
      // Checkpoints
      checkpoints: []
    };
  }

  /**
   * Validate session integrity
   */
  validateSession(session) {
    return session &&
           session.id &&
           session.version &&
           session.project === 'SYNTHEX' &&
           session.workState &&
           session.preferences;
  }

  /**
   * Save current session state
   */
  async saveSession() {
    if (!this.currentSession) return;

    try {
      // Update metrics
      this.currentSession.lastSaved = new Date().toISOString();
      this.currentSession.metrics.totalOperations = this.operationCount;
      
      // Write session file
      await fs.writeFile(
        this.sessionFile,
        JSON.stringify(this.currentSession, null, 2)
      );
      
      // Create backup if significant changes
      if (this.operationCount % 50 === 0) {
        await this.createBackup();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save session:', error);
      return false;
    }
  }

  /**
   * Start auto-save mechanism
   */
  startAutoSave() {
    // Save every 10 operations or 5 minutes
    this.autoSaveInterval = setInterval(async () => {
      if (this.operationCount >= 10) {
        await this.saveSession();
        this.operationCount = 0;
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Create session backup
   */
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(
      this.backupDir,
      `session-backup-${timestamp}.json`
    );
    
    await fs.copyFile(this.sessionFile, backupFile);
    
    // Clean old backups (keep last 10)
    await this.cleanOldBackups();
  }

  /**
   * Clean old backup files
   */
  async cleanOldBackups() {
    const files = await fs.readdir(this.backupDir);
    const backups = files
      .filter(f => f.startsWith('session-backup-'))
      .sort()
      .reverse();
    
    // Keep only last 10 backups
    for (let i = 10; i < backups.length; i++) {
      await fs.unlink(path.join(this.backupDir, backups[i]));
    }
  }

  /**
   * Log event to history
   */
  async logEvent(eventType, data) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: eventType,
      data,
      sessionId: this.currentSession?.id
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    await fs.appendFile(this.historyFile, logLine);
  }

  /**
   * Update work state
   */
  async updateWorkState(updates) {
    if (!this.currentSession) return;
    
    this.currentSession.workState = {
      ...this.currentSession.workState,
      ...updates
    };
    
    this.operationCount++;
    
    // Auto-save after 10 operations
    if (this.operationCount >= 10) {
      await this.saveSession();
      this.operationCount = 0;
    }
  }

  /**
   * Add task to completed list
   */
  async completeTask(task) {
    if (!this.currentSession) return;
    
    this.currentSession.workState.completedTasks.push({
      ...task,
      completedAt: new Date().toISOString()
    });
    
    await this.logEvent('TASK_COMPLETED', task);
    await this.updateWorkState({
      currentTask: null
    });
  }

  /**
   * Track error
   */
  async trackError(error) {
    if (!this.currentSession) return;
    
    const errorEntry = {
      timestamp: new Date().toISOString(),
      message: error.message || error,
      stack: error.stack,
      context: this.currentSession.workState.currentTask
    };
    
    this.currentSession.errors.push(errorEntry);
    await this.logEvent('ERROR', errorEntry);
    
    // Save immediately for errors
    await this.saveSession();
  }

  /**
   * Create checkpoint
   */
  async createCheckpoint(name, description) {
    if (!this.currentSession) return;
    
    const checkpoint = {
      id: crypto.randomUUID(),
      name,
      description,
      timestamp: new Date().toISOString(),
      workState: { ...this.currentSession.workState },
      metrics: { ...this.currentSession.metrics }
    };
    
    this.currentSession.checkpoints.push(checkpoint);
    await this.logEvent('CHECKPOINT_CREATED', checkpoint);
    await this.saveSession();
    
    return checkpoint;
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(checkpointId) {
    if (!this.currentSession) return;
    
    const checkpoint = this.currentSession.checkpoints.find(
      cp => cp.id === checkpointId
    );
    
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    
    this.currentSession.workState = { ...checkpoint.workState };
    this.currentSession.metrics = { ...checkpoint.metrics };
    
    await this.logEvent('CHECKPOINT_RESTORED', checkpoint);
    await this.saveSession();
    
    return checkpoint;
  }

  /**
   * Update resource usage metrics
   */
  async updateResourceMetrics(cpu, memory) {
    if (!this.currentSession) return;
    
    const metrics = this.currentSession.metrics.resourceUsage;
    
    // Keep last 100 measurements
    metrics.cpu.push({ value: cpu, timestamp: Date.now() });
    metrics.memory.push({ value: memory, timestamp: Date.now() });
    
    if (metrics.cpu.length > 100) metrics.cpu.shift();
    if (metrics.memory.length > 100) metrics.memory.shift();
  }

  /**
   * Get session summary
   */
  getSessionSummary() {
    if (!this.currentSession) return null;
    
    return {
      id: this.currentSession.id,
      duration: Date.now() - new Date(this.currentSession.createdAt).getTime(),
      tasksCompleted: this.currentSession.workState.completedTasks.length,
      tasksPending: this.currentSession.workState.pendingTasks.length,
      totalOperations: this.currentSession.metrics.totalOperations,
      successRate: this.currentSession.metrics.successfulOperations / 
                   this.currentSession.metrics.totalOperations * 100,
      errors: this.currentSession.errors.length,
      checkpoints: this.currentSession.checkpoints.length
    };
  }

  /**
   * Export session data
   */
  async exportSession(format = 'json') {
    if (!this.currentSession) return null;
    
    const exportData = {
      ...this.currentSession,
      exported: new Date().toISOString(),
      summary: this.getSessionSummary()
    };
    
    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    }
    
    // Add other formats as needed (CSV, MD, etc.)
    return exportData;
  }

  /**
   * Clean up and close session
   */
  async close() {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    await this.saveSession();
    await this.logEvent('SESSION_END', {
      sessionId: this.currentSession?.id,
      summary: this.getSessionSummary()
    });
    
    this.currentSession = null;
  }
}

// Export singleton instance
const sessionManager = new SessionManager();
export default sessionManager;