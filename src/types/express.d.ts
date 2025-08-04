import { User } from '../services/auth';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      name?: string;
      createdAt: Date;
      preferences?: any;
      avatar?: string;
      authProvider?: string;
      googleId?: string;
    }
  }
}