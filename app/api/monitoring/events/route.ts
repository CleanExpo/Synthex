import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/** Monitoring event structure */
interface MonitoringEvent {
  sessionId: string;
  userId?: string;
  timestamp: string;
  type: string;
  data?: Record<string, unknown>;
}

// In-memory storage for development
// In production, this should write to a database or external service
const events: MonitoringEvent[] = [];

const monitoringEventSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  userId: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  data: z.record(z.unknown()).optional(),
  errors: z.array(z.any()).optional(),
  actions: z.array(z.any()).optional(),
}).passthrough();

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validation = monitoringEventSchema.safeParse(rawBody);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      );
    }
    const body = validation.data;

    // Process errors
    if (body.errors && body.errors.length > 0) {
      for (const error of body.errors) {
        console.error('[Error Tracked]:', {
          message: error instanceof Error ? error.message : String(error),
          url: error.context?.url,
          userId: body.userId,
          sessionId: body.sessionId,
          timestamp: error.timestamp,
        });

        // In production, send to error tracking service
        if (process.env.NODE_ENV === 'production') {
          // Example: Send to Sentry, LogRocket, etc.
          // await sendToSentry(error);
        }
      }
    }

    // Process user actions
    if (body.actions && body.actions.length > 0) {
      for (const action of body.actions) {
        // In production, send to analytics service
        if (process.env.NODE_ENV === 'production') {
          // Example: Send to Google Analytics, Mixpanel, etc.
          // await sendToAnalytics(action);
        }
      }
    }

    // Store events (for development)
    events.push({
      ...body,
      receivedAt: new Date().toISOString(),
    } as MonitoringEvent);

    // Keep only last 1000 events in memory
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing monitoring events:', error);
    return NextResponse.json(
      { error: 'Failed to process events' },
      { status: 500 }
    );
  }
}

// GET endpoint for development debugging
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    totalEvents: events.length,
    events: events.slice(-10), // Return last 10 events
  });
}