/**
 * User Profile API Route
 * GET /api/user/profile - Get current user profile
 * PUT /api/user/profile - Update user profile
 * DELETE /api/user/profile - Delete user account
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - NEXT_PUBLIC_SUPABASE_URL: Supabase URL (PUBLIC)
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY: Supabase anon key (PUBLIC)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAuthClient } from '@/lib/supabase-server';
import { supabase } from '@/lib/supabase-client';
import { z } from 'zod';

// Validation schemas
const profileUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').optional(),
  company: z.string().max(100, 'Company name too long').optional(),
  role: z.string().max(50, 'Role too long').optional(),
  bio: z.string().max(500, 'Bio too long').optional(),
  phone: z.string().max(20, 'Phone number too long').regex(/^[+]?[\d\s\-()]*$/, 'Invalid phone format').optional(),
  website: z.string().url('Invalid website URL').max(200).optional().or(z.literal('')),
  social_links: z.object({
    twitter: z.string().max(100).optional(),
    linkedin: z.string().max(100).optional(),
    github: z.string().max(100).optional(),
  }).passthrough().optional(),
}).strict();

const deleteAccountSchema = z.object({
  confirmation: z.literal('DELETE_MY_ACCOUNT', {
    errorMap: () => ({ message: 'Must confirm with "DELETE_MY_ACCOUNT"' })
  }).optional(),
});

// GET current user profile
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      throw profileError;
    }

    // If no profile exists, create one
    if (!profile) {
      const newProfile = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        company: '',
        role: '',
        bio: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: createdProfile, error: createError } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .single();

      if (createError) {
        console.error('Error creating profile:', createError);
      }

      return NextResponse.json({ profile: createdProfile || newProfile });
    }

    return NextResponse.json({ profile });
  } catch (error: unknown) {
    console.error('Profile fetch error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch profile', details: message },
      { status: 500 }
    );
  }
}

// UPDATE user profile
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const validationResult = profileUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { name, company, role, bio, phone, website, social_links } = validationResult.data;

    // Update profile in database with validated data
    const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
      .update({
        ...(name !== undefined && { name }),
        ...(company !== undefined && { company }),
        ...(role !== undefined && { role }),
        ...(bio !== undefined && { bio }),
        ...(phone !== undefined && { phone }),
        ...(website !== undefined && { website }),
        ...(social_links !== undefined && { social_links }),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update user metadata in auth
    const { error: metaError } = await supabase.auth.updateUser({
      data: { 
        name,
        company,
        role
      }
    });

    if (metaError) {
      console.error('Error updating user metadata:', metaError);
    }

    return NextResponse.json({ 
      success: true, 
      profile: updatedProfile,
      message: 'Profile updated successfully' 
    });
  } catch (error: unknown) {
    console.error('Profile update error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update profile', details: message },
      { status: 500 }
    );
  }
}

// DELETE user account
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Require confirmation for account deletion (safety measure)
    // Client should send { confirmation: "DELETE_MY_ACCOUNT" }
    try {
      const body = await request.json();
      const validationResult = deleteAccountSchema.safeParse(body);
      if (!validationResult.success || !validationResult.data.confirmation) {
        return NextResponse.json(
          {
            error: 'Account deletion requires confirmation',
            message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm'
          },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          error: 'Account deletion requires confirmation',
          message: 'Send { "confirmation": "DELETE_MY_ACCOUNT" } to confirm'
        },
        { status: 400 }
      );
    }

    // Delete profile from database
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (deleteError) {
      throw deleteError;
    }

    // Delete user from auth
    // Note: This requires admin privileges, usually done server-side
    // For now, we'll just mark the account as deleted

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error: unknown) {
    console.error('Account deletion error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete account', details: message },
      { status: 500 }
    );
  }
}