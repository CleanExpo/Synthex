/**
 * Application Configuration
 * Handles domain-specific settings for production
 */

export const getAppConfig = () => {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isVercel = process.env.VERCEL === '1';
  
  // Production domain
  const PRODUCTION_DOMAIN = 'synthex.social';
  
  // Determine the current domain
  let domain = 'localhost:3000';
  let protocol = 'http';
  
  if (isVercel || process.env.NODE_ENV === 'production') {
    domain = PRODUCTION_DOMAIN;
    protocol = 'https';
  } else if (process.env.VERCEL_URL) {
    domain = process.env.VERCEL_URL;
    protocol = 'https';
  }
  
  const baseUrl = `${protocol}://${domain}`;
  
  return {
    app: {
      name: 'Synthex',
      description: 'AI-Powered Marketing Platform',
      domain,
      baseUrl,
      apiUrl: `${baseUrl}/api`,
      environment: process.env.NODE_ENV || 'development'
    },
    oauth: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: `${baseUrl}/auth/google/callback`
      }
    },
    cors: {
      origin: isDevelopment 
        ? ['http://localhost:3000', 'http://localhost:3001']
        : [`https://${PRODUCTION_DOMAIN}`, `https://www.${PRODUCTION_DOMAIN}`],
      credentials: true
    },
    cookies: {
      domain: isDevelopment ? 'localhost' : `.${PRODUCTION_DOMAIN}`,
      secure: !isDevelopment,
      sameSite: 'lax' as const,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    },
    security: {
      jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      bcryptRounds: 10,
      enableRateLimit: !isDevelopment,
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000 // 15 minutes
    }
  };
};

export const appConfig = getAppConfig();