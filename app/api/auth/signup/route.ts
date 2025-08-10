import { NextResponse } from 'next/server';
import { auth } from '@/lib/supabase-client';

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const data = await auth.signUp(email, password, name);

    return NextResponse.json({
      success: true,
      user: data.user,
      message: 'Account created successfully! Please check your email to verify your account.',
    });
  } catch (error: any) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 400 }
    );
  }
}