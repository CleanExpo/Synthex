import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || email.split('@')[0],
        authProvider: 'local',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      }
    });

    // Log the signup event
    await prisma.auditLog.create({
      data: {
        action: 'user_signup',
        resource: 'authentication',
        resourceId: user.id,
        category: 'auth',
        outcome: 'success',
        userId: user.id,
      }
    });

    return NextResponse.json({
      success: true,
      user,
      message: 'Account created successfully!',
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Log failed signup attempt
    await prisma.auditLog.create({
      data: {
        action: 'user_signup_failed',
        resource: 'authentication',
        category: 'auth',
        outcome: 'failure',
        details: { error: error.message },
      }
    }).catch(console.error);

    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}