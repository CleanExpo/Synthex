/**
 * Authentication API Endpoints
 * Handles login, signup, password reset, and session management
 */

import { authService } from '../src/lib/auth.js';
import { supabase, db, auth } from '../src/lib/supabase.js';

// Helper function to get client IP
function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection.remoteAddress || 
         '127.0.0.1';
}

// Helper function to validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Main authentication handler
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method, query, body } = req;
  const action = query.action;

  try {
    switch (method) {
      case 'POST':
        switch (action) {
          case 'signup':
            return await handleSignup(req, res);
          case 'login':
            return await handleLogin(req, res);
          case 'logout':
            return await handleLogout(req, res);
          case 'refresh':
            return await handleRefreshToken(req, res);
          case 'reset-password':
            return await handleResetPassword(req, res);
          case 'update-password':
            return await handleUpdatePassword(req, res);
          default:
            res.status(400).json({ error: 'Invalid action' });
        }
        break;
      
      case 'GET':
        switch (action) {
          case 'me':
            return await handleGetCurrentUser(req, res);
          case 'verify':
            return await handleVerifyEmail(req, res);
          default:
            res.status(400).json({ error: 'Invalid action' });
        }
        break;
      
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Auth API error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Handle user signup
async function handleSignup(req, res) {
  const { email, password, fullName, company } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ 
      error: 'Invalid email format' 
    });
  }

  // Validate password
  const passwordValidation = authService.validatePassword(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ 
      error: 'Password validation failed',
      details: passwordValidation.errors
    });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = authService.checkRateLimit(clientIP, 'signup');
  
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: rateLimit.message,
      resetTime: rateLimit.resetTime
    });
  }

  try {
    // Sign up with Supabase
    const { data, error } = await auth.signUp(email, password, {
      full_name: fullName,
      company: company
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      message: 'User created successfully. Please check your email for verification.',
      user: {
        id: data.user.id,
        email: data.user.email,
        emailConfirmed: data.user.email_confirmed_at !== null
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
}

// Handle user login
async function handleLogin(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ 
      error: 'Email and password are required' 
    });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = authService.checkRateLimit(clientIP, 'login');
  
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: rateLimit.message,
      resetTime: rateLimit.resetTime
    });
  }

  try {
    // Sign in with Supabase
    const { data, error } = await auth.signIn(email, password);

    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user profile
    const profile = await db.users.getProfile(data.user.id);

    // Create our own JWT token for additional claims
    const authResponse = authService.createAuthResponse({
      id: data.user.id,
      email: data.user.email,
      ...profile
    });

    // Set secure cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.setHeader('Set-Cookie', `token=${authResponse.token}; ${
      Object.entries(authService.getCookieOptions(isProduction))
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
    }`);

    res.json({
      message: 'Login successful',
      ...authResponse,
      supabaseSession: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}

// Handle logout
async function handleLogout(req, res) {
  try {
    await auth.signOut();

    // Clear cookie
    res.setHeader('Set-Cookie', 'token=; Max-Age=0; Path=/; HttpOnly');

    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
}

// Handle token refresh
async function handleRefreshToken(req, res) {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  try {
    // Refresh Supabase session
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Get updated user profile
    const profile = await db.users.getProfile(data.user.id);

    // Create new JWT token
    const authResponse = authService.createAuthResponse({
      id: data.user.id,
      email: data.user.email,
      ...profile
    });

    res.json(authResponse);

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
}

// Handle password reset request
async function handleResetPassword(req, res) {
  const { email } = req.body;

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  // Rate limiting
  const clientIP = getClientIP(req);
  const rateLimit = authService.checkRateLimit(clientIP, 'resetPassword');
  
  if (!rateLimit.allowed) {
    return res.status(429).json({
      error: rateLimit.message,
      resetTime: rateLimit.resetTime
    });
  }

  try {
    await auth.resetPassword(email);
    
    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.json({ 
      message: 'If an account with that email exists, a password reset link has been sent.' 
    });
  }
}

// Handle password update
async function handleUpdatePassword(req, res) {
  const { newPassword, accessToken } = req.body;

  if (!newPassword) {
    return res.status(400).json({ error: 'New password is required' });
  }

  // Validate password
  const passwordValidation = authService.validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({ 
      error: 'Password validation failed',
      details: passwordValidation.errors
    });
  }

  try {
    // Update password with Supabase
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ error: 'Password update failed' });
  }
}

// Handle get current user
async function handleGetCurrentUser(req, res) {
  try {
    const user = await auth.getCurrentUser();
    
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const profile = await db.users.getProfile(user.id);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        ...profile
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
}

// Handle email verification
async function handleVerifyEmail(req, res) {
  const { token, type } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Verification token required' });
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: token,
      type: type || 'signup'
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ 
      message: 'Email verified successfully',
      user: data.user
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
}