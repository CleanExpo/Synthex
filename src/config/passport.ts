import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { authService } from '../services/auth';

// Configure Google OAuth Strategy only if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  console.log('Configuring Google OAuth strategy...');
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
  try {
    // Extract user information from Google profile
    const googleId = profile.id;
    const email = profile.emails?.[0]?.value;
    const name = profile.displayName || profile.name?.givenName || 'Google User';
    const avatar = profile.photos?.[0]?.value;

    if (!email) {
      return done(new Error('No email found in Google profile'), undefined);
    }

    // Check if user already exists
    let user = await authService.findUserByEmail(email);

    if (user) {
      // Update existing user with Google info
      user = await authService.updateUserGoogleInfo(user.id, {
        googleId,
        avatar,
        lastLogin: new Date()
      });
    } else {
      // Create new user with Google info
      user = await authService.createGoogleUser({
        email,
        name,
        googleId,
        avatar
      });
    }

    return done(null, user);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return done(error, undefined);
  }
  }));
} else {
  console.warn('Google OAuth not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
}

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await authService.getUserById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;