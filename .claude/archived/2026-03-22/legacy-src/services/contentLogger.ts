import fs from 'fs/promises';
import path from 'path';

interface ContentLogEntry {
  id: string;
  timestamp: string;
  type: 'generate' | 'optimize' | 'variations';
  input: {
    prompt?: string;
    content?: string;
    contentType?: string;
    platform?: string;
    goals?: string[];
    count?: number;
  };
  output: any;
  metadata: {
    model?: string;
    tokensUsed?: number;
    processingTime?: number;
    ipAddress?: string;
  };
}

class ContentLogger {
  private logDir: string;
  private maxLogSize: number = 100; // Keep last 100 entries in memory
  private recentLogs: ContentLogEntry[] = [];

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs', 'content');
    this.initializeLogDirectory();
  }

  private async initializeLogDirectory() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Generate a unique ID for log entries
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log content generation activity
   */
  async logGeneration(
    prompt: string,
    contentType: string,
    output: string,
    metadata?: Partial<ContentLogEntry['metadata']>
  ): Promise<string> {
    const entry: ContentLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'generate',
      input: { prompt, contentType },
      output,
      metadata: metadata || {}
    };

    await this.saveLog(entry);
    return entry.id;
  }

  /**
   * Log content optimization activity
   */
  async logOptimization(
    content: string,
    platform: string,
    goals: string[],
    output: any,
    metadata?: Partial<ContentLogEntry['metadata']>
  ): Promise<string> {
    const entry: ContentLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'optimize',
      input: { content, platform, goals },
      output,
      metadata: metadata || {}
    };

    await this.saveLog(entry);
    return entry.id;
  }

  /**
   * Log variations generation activity
   */
  async logVariations(
    prompt: string,
    count: number,
    contentType: string,
    output: string[],
    metadata?: Partial<ContentLogEntry['metadata']>
  ): Promise<string> {
    const entry: ContentLogEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: 'variations',
      input: { prompt, count, contentType },
      output,
      metadata: metadata || {}
    };

    await this.saveLog(entry);
    return entry.id;
  }

  /**
   * Save log entry to file and memory
   */
  private async saveLog(entry: ContentLogEntry): Promise<void> {
    // Add to recent logs in memory
    this.recentLogs.unshift(entry);
    if (this.recentLogs.length > this.maxLogSize) {
      this.recentLogs = this.recentLogs.slice(0, this.maxLogSize);
    }

    // Save to daily log file
    const date = new Date().toISOString().split('T')[0];
    const filename = `content-${date}.json`;
    const filepath = path.join(this.logDir, filename);

    try {
      // Read existing logs for today
      let logs: ContentLogEntry[] = [];
      try {
        const existingData = await fs.readFile(filepath, 'utf-8');
        logs = JSON.parse(existingData);
      } catch (error) {
        // File doesn't exist yet, start with empty array
        logs = [];
      }

      // Add new entry and save
      logs.push(entry);
      await fs.writeFile(filepath, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Failed to save log entry:', error);
    }
  }

  /**
   * Get recent logs from memory
   */
  getRecentLogs(limit: number = 10): ContentLogEntry[] {
    return this.recentLogs.slice(0, limit);
  }

  /**
   * Get logs by date
   */
  async getLogsByDate(date: string): Promise<ContentLogEntry[]> {
    const filename = `content-${date}.json`;
    const filepath = path.join(this.logDir, filename);

    try {
      const data = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  /**
   * Get log by ID
   */
  async getLogById(id: string): Promise<ContentLogEntry | null> {
    // Check memory first
    const memoryLog = this.recentLogs.find(log => log.id === id);
    if (memoryLog) return memoryLog;

    // Search in files
    try {
      const files = await fs.readdir(this.logDir);
      for (const file of files) {
        if (file.startsWith('content-') && file.endsWith('.json')) {
          const filepath = path.join(this.logDir, file);
          const data = await fs.readFile(filepath, 'utf-8');
          const logs: ContentLogEntry[] = JSON.parse(data);
          const found = logs.find(log => log.id === id);
          if (found) return found;
        }
      }
    } catch (error) {
      console.error('Error searching for log:', error);
    }

    return null;
  }

  /**
   * Get statistics from logs
   */
  async getStatistics(days: number = 7): Promise<{
    totalRequests: number;
    byType: Record<string, number>;
    byContentType: Record<string, number>;
    averageTokensUsed: number;
    mostActiveHours: Record<string, number>;
  }> {
    const stats = {
      totalRequests: 0,
      byType: {} as Record<string, number>,
      byContentType: {} as Record<string, number>,
      averageTokensUsed: 0,
      mostActiveHours: {} as Record<string, number>
    };

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let totalTokens = 0;
    let tokenCount = 0;

    // Process logs for the specified period
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const logs = await this.getLogsByDate(dateStr);

      for (const log of logs) {
        stats.totalRequests++;

        // Count by type
        stats.byType[log.type] = (stats.byType[log.type] || 0) + 1;

        // Count by content type
        if (log.input.contentType) {
          stats.byContentType[log.input.contentType] = 
            (stats.byContentType[log.input.contentType] || 0) + 1;
        }

        // Track tokens
        if (log.metadata.tokensUsed) {
          totalTokens += log.metadata.tokensUsed;
          tokenCount++;
        }

        // Track hourly activity
        const hour = new Date(log.timestamp).getHours().toString();
        stats.mostActiveHours[hour] = (stats.mostActiveHours[hour] || 0) + 1;
      }
    }

    stats.averageTokensUsed = tokenCount > 0 ? Math.round(totalTokens / tokenCount) : 0;

    return stats;
  }

  /**
   * Clean old logs (keep only last N days)
   */
  async cleanOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deletedCount = 0;

    try {
      const files = await fs.readdir(this.logDir);
      for (const file of files) {
        if (file.startsWith('content-') && file.endsWith('.json')) {
          const dateStr = file.replace('content-', '').replace('.json', '');
          const fileDate = new Date(dateStr);
          
          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.logDir, file));
            deletedCount++;
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning old logs:', error);
    }

    return deletedCount;
  }
}

// Export singleton instance
export const contentLogger = new ContentLogger();