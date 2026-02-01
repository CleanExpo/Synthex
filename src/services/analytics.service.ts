import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AnalyticsEvent {
  userId?: string;
  sessionId?: string;
  eventType: string;
  eventName: string;
  properties?: Record<string, any>;
  platform?: string;
  url?: string;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface PageView {
  userId?: string;
  sessionId: string;
  path: string;
  title?: string;
  referrer?: string;
  durationMs?: number;
  platform?: string;
  userAgent?: string;
  ipAddress?: string;
}

export class AnalyticsService {
  static async trackEvent(data: AnalyticsEvent) {
    try {
      // Note: This uses the raw query approach since the table was created via migration
      await prisma.$executeRaw`
        INSERT INTO analytics_events (
          user_id, session_id, event_type, event_name, properties, 
          platform, url, referrer, user_agent, ip_address
        ) VALUES (
          ${data.userId || null}, ${data.sessionId || null}, ${data.eventType}, 
          ${data.eventName}, ${JSON.stringify(data.properties || {})}::jsonb,
          ${data.platform || null}, ${data.url || null}, ${data.referrer || null},
          ${data.userAgent || null}, ${data.ipAddress || null}
        )
      `;
      return { success: true };
    } catch (error) {
      console.error('Error tracking analytics event:', error);
      return { success: false, error };
    }
  }

  static async trackPageView(data: PageView) {
    try {
      await prisma.$executeRaw`
        INSERT INTO analytics_page_views (
          user_id, session_id, path, title, referrer, 
          duration_ms, platform, user_agent, ip_address
        ) VALUES (
          ${data.userId || null}, ${data.sessionId}, ${data.path}, 
          ${data.title || null}, ${data.referrer || null},
          ${data.durationMs || 0}, ${data.platform || null},
          ${data.userAgent || null}, ${data.ipAddress || null}
        )
      `;
      return { success: true };
    } catch (error) {
      console.error('Error tracking page view:', error);
      return { success: false, error };
    }
  }

  static async getUserStats(userId: string, days: number = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const [events, pageViews] = await Promise.all([
        prisma.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*) as count FROM analytics_events 
          WHERE user_id = ${userId} AND created_at >= ${startDate}
        `,
        prisma.$queryRaw<{ count: number }[]>`
          SELECT COUNT(*) as count FROM analytics_page_views 
          WHERE user_id = ${userId} AND created_at >= ${startDate}
        `
      ]);

      return {
        success: true,
        data: {
          totalEvents: Number(events[0]?.count || 0),
          totalPageViews: Number(pageViews[0]?.count || 0),
          period: `${days} days`
        }
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { success: false, error };
    }
  }
}

export default AnalyticsService;
