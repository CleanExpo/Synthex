import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

// Mock database for demo purposes
const integrationConnections = new Map();

export async function POST(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const { integrationId } = params;
    const body = await request.json();
    
    // Get user from session/cookie (simplified for demo)
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    let userId = 'demo-user'; // Default for demo
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        userId = decoded.userId;
      } catch {
        // Use demo user if token is invalid
      }
    }

    // Validate integration ID
    const validIntegrations = ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok'];
    if (!validIntegrations.includes(integrationId)) {
      return NextResponse.json(
        { error: 'Invalid integration' },
        { status: 400 }
      );
    }

    // Store connection (in production, encrypt and store in database)
    const connectionKey = `${userId}-${integrationId}`;
    integrationConnections.set(connectionKey, {
      integrationId,
      userId,
      credentials: body,
      connectedAt: new Date().toISOString(),
      accountName: `@${integrationId}_user`,
      status: 'active'
    });

    return NextResponse.json({
      success: true,
      integration: {
        id: integrationId,
        connected: true,
        accountName: `@${integrationId}_user`,
        connectedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error connecting integration:', error);
    return NextResponse.json(
      { error: 'Failed to connect integration' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const { integrationId } = params;
    
    // Get user from session/cookie
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    let userId = 'demo-user';
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        userId = decoded.userId;
      } catch {
        // Use demo user if token is invalid
      }
    }

    const connectionKey = `${userId}-${integrationId}`;
    const connection = integrationConnections.get(connectionKey);

    if (!connection) {
      return NextResponse.json({
        id: integrationId,
        connected: false
      });
    }

    return NextResponse.json({
      id: integrationId,
      connected: true,
      accountName: connection.accountName,
      connectedAt: connection.connectedAt,
      status: connection.status
    });
  } catch (error) {
    console.error('Error getting integration status:', error);
    return NextResponse.json(
      { error: 'Failed to get integration status' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  try {
    const { integrationId } = params;
    
    // Get user from session/cookie
    const cookieStore = cookies();
    const token = cookieStore.get('auth-token')?.value;
    
    let userId = 'demo-user';
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
        userId = decoded.userId;
      } catch {
        // Use demo user if token is invalid
      }
    }

    const connectionKey = `${userId}-${integrationId}`;
    integrationConnections.delete(connectionKey);

    return NextResponse.json({
      success: true,
      message: 'Integration disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting integration:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect integration' },
      { status: 500 }
    );
  }
}