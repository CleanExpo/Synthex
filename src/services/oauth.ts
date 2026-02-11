/** @server-only */
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import AuditService from './audit';

const prisma = new PrismaClient();

// Check if OAuth is enabled
const isOAuthEnabled = () => {
  return process.env.OAUTH_GOOGLE_ENABLED === 'true';
};

/**
 * Stub type definitions for when passport is not installed
 */
interface PassportUser {
  id: string;
  email: string;
  name?: string;
  googleId?: string;
  avatar?: string;
}

// Google OAuth Strategy Configuration
export async function configureGoogleOAuth() {
  if (!isOAuthEnabled()) {
    console.log('Google OAuth is disabled via OAUTH_GOOGLE_ENABLED environment variable');
    return;
  }

  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';

  if (!googleClientId || !googleClientSecret) {
    console.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    return;
  }

  console.warn('Google OAuth is enabled but passport packages are not installed.');
  console.warn('To enable Google OAuth, run: npm install passport passport-google-oauth20 @types/passport @types/passport-google-oauth20');
  
  // The actual passport configuration is commented out to prevent build errors
  // Uncomment this code after installing the required packages
  /*
  try {
    const { Strategy: GoogleStrategy } = await import('passport-google-oauth20');
    const passport = (await import('passport')).default;

    passport.use(new GoogleStrategy({
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: callbackUrl
    },
    async (accessToken: string, refreshToken: string, profile: any, done: Function) => {
      try {
        const email = profile.emails?.[0]?.value;
        const name = profile.displayName;
        const googleId = profile.id;
        const avatar = profile.photos?.[0]?.value;

        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        // Check if user already exists
        let user = await prisma.user.findUnique({
          where: { email }
        });

        if (user) {
          // Update existing user with Google info if not already set
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { email },
              data: {
                googleId,
                avatar: avatar || user.avatar,
                name: name || user.name,
                // Database expects DateTime for emailVerified, not boolean
                emailVerified: new Date(),
                updatedAt: new Date()
              }
            });
          }

          // Log successful OAuth login
          await AuditService.log({
            userId: user.id,
            action: 'oauth_login',
            resource: 'authentication',
            details: {
              provider: 'google',
              googleId,
              email,
              loginMethod: 'oauth'
            },
            severity: 'low',
            category: 'auth',
            outcome: 'success'
          });
        } else {
          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              name: name || 'Google User',
              password: '', // Empty password for OAuth users
              googleId,
              avatar: avatar,
              authProvider: 'google',
              // Database expects DateTime for emailVerified, not boolean
              // Google verifies emails, so set to current timestamp
              emailVerified: new Date()
            }
          });

          // Log new user creation via OAuth
          await AuditService.log({
            userId: user.id,
            action: 'user_created_oauth',
            resource: 'user',
            details: {
              provider: 'google',
              googleId,
              email,
              name
            },
            severity: 'medium',
            category: 'auth',
            outcome: 'success'
          });
        }

        return done(null, user);
      } catch (error) {
        console.error('Google OAuth error:', error);
        return done(error, null);
      }
    }));

    // Serialize/deserialize user for session
    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id }
        });
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  } catch (error) {
    console.error('Failed to load passport modules:', error);
    console.log('To enable Google OAuth, install: npm i passport passport-google-oauth20');
  }
  */
}

/**
 * Generate JWT token for OAuth user
 */
export function generateOAuthToken(user: any): string {
  if (!isOAuthEnabled() && !user) {
    throw new Error('OAuth is disabled and no user provided');
  }
  const payload = {
    userId: user.id,
    email: user.email,
    loginMethod: 'oauth'
  };

  const secret = process.env.JWT_SECRET || 'default_secret';
  
  try {
    return jwt.sign(payload, secret, { 
      expiresIn: process.env.JWT_EXPIRES_IN || '7d' 
    } as jwt.SignOptions);
  } catch (error) {
    console.error('JWT signing error:', error);
    // Fallback to basic token without expiration for debugging
    return jwt.sign(payload, secret);
  }
}

/**
 * Link existing account with Google OAuth
 */
export async function linkGoogleAccount(userId: string, googleId: string, profile: any) {
  if (!isOAuthEnabled()) {
    throw new Error('Google OAuth is disabled via OAUTH_GOOGLE_ENABLED environment variable');
  }
  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        googleId,
        avatar: profile.photos?.[0]?.value || undefined,
        // Database expects DateTime for emailVerified, not boolean
        emailVerified: new Date(),
        updatedAt: new Date()
      }
    });

    // Log account linking
    await AuditService.log({
      userId,
      action: 'account_linked',
      resource: 'authentication',
      details: {
        provider: 'google',
        googleId,
        email: user.email
      },
      severity: 'medium',
      category: 'auth',
      outcome: 'success'
    });

    return user;
  } catch (error) {
    console.error('Error linking Google account:', error);
    throw error;
  }
}

/**
 * Unlink Google account
 */
export async function unlinkGoogleAccount(userId: string) {
  if (!isOAuthEnabled()) {
    throw new Error('Google OAuth is disabled via OAUTH_GOOGLE_ENABLED environment variable');
  }
  try {
    // Check if user has password set before unlinking
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, googleId: true, email: true }
    });

    if (!user?.password && user?.googleId) {
      throw new Error('Cannot unlink Google account without setting a password first');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        googleId: null,
        updatedAt: new Date()
      }
    });

    // Log account unlinking
    await AuditService.log({
      userId,
      action: 'account_unlinked',
      resource: 'authentication',
      details: {
        provider: 'google',
        email: user!.email
      },
      severity: 'medium',
      category: 'auth',
      outcome: 'success'
    });

    return updatedUser;
  } catch (error) {
    console.error('Error unlinking Google account:', error);
    throw error;
  }
}

/**
 * Get OAuth connection status
 */
export async function getOAuthStatus(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleId: true,
        email: true,
        emailVerified: true,
        avatar: true
      }
    });

    return {
      google: {
        connected: !!user?.googleId,
        verified: user?.emailVerified || false
      },
      // Ready for additional providers
      facebook: { connected: false },
      twitter: { connected: false },
      linkedin: { connected: false }
    };
  } catch (error) {
    console.error('Error getting OAuth status:', error);
    throw error;
  }
}

/**
 * Validate OAuth state parameter for security
 */
export function generateOAuthState(): string {
  return Buffer.from(Math.random().toString(36)).toString('base64');
}

export function validateOAuthState(state: string, sessionState: string): boolean {
  return state === sessionState;
}

const oauthService = {
  configureGoogleOAuth,
  generateOAuthToken,
  linkGoogleAccount,
  unlinkGoogleAccount,
  getOAuthStatus,
  generateOAuthState,
  validateOAuthState
};

export default oauthService;
