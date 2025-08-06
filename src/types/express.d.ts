import express from 'express';

// Re-export everything from express including the default export
export default express;
export * from 'express';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name: string | null;
      createdAt: Date;
      preferences?: any;
      avatar?: string;
      authProvider?: string;
      googleId?: string;
    }
    
    interface Request {
      user?: User;
      rateLimit?: {
        resetTime?: number;
        limit?: number;
        remaining?: number;
        used?: number;
      };
    }
  }
}

// Additional type for authenticated requests
export interface AuthenticatedRequest extends Express.Request {
  user: Express.User;
  headers: any;
}
