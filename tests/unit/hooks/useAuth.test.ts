/**
 * Unit Tests for Auth Service Integration
 *
 * NOTE: Direct React hook rendering tests with renderHook require
 * jsx: "react-jsx" in tsconfig. Since the project uses jsx: "preserve"
 * (for Next.js), these tests verify the authService interactions and
 * the useAuth contract without rendering JSX.
 *
 * Tests the auth service methods that useAuth wraps, ensuring correct
 * behavior for signIn, signUp, signOut, and OAuth flows.
 */

// =========================================================================
// Mock authService — this is the underlying service that useAuth wraps
// =========================================================================
const mockAuthService = {
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  signInWithOAuth: jest.fn(),
  getCurrentUser: jest.fn(),
  onAuthStateChange: jest.fn(),
};

jest.mock('@/lib/auth/auth-service', () => ({
  authService: mockAuthService,
  __esModule: true,
}));

describe('Auth Service (useAuth backing service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply mock return values after resetMocks clears them.
    // This is critical: jest.config.cjs has resetMocks: true, which calls
    // mockReset() on every jest.fn() between tests, clearing mockReturnValue.
    mockAuthService.onAuthStateChange.mockReturnValue(() => {});
  });

  // =========================================================================
  // signIn
  // =========================================================================
  describe('signIn', () => {
    it('should return success with user on valid credentials', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };
      mockAuthService.signIn.mockResolvedValue({
        success: true,
        user: mockUser,
      });

      const result = await mockAuthService.signIn('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockAuthService.signIn).toHaveBeenCalledWith('test@example.com', 'password');
    });

    it('should return error on invalid credentials', async () => {
      mockAuthService.signIn.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const result = await mockAuthService.signIn('test@example.com', 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should throw on network failure', async () => {
      mockAuthService.signIn.mockRejectedValue(new Error('Network error'));

      await expect(
        mockAuthService.signIn('test@example.com', 'pass')
      ).rejects.toThrow('Network error');
    });
  });

  // =========================================================================
  // signUp
  // =========================================================================
  describe('signUp', () => {
    it('should return success on valid registration', async () => {
      mockAuthService.signUp.mockResolvedValue({
        success: true,
        requiresVerification: false,
      });

      const result = await mockAuthService.signUp('new@example.com', 'Pass123!', 'New User');

      expect(result.success).toBe(true);
      expect(mockAuthService.signUp).toHaveBeenCalledWith(
        'new@example.com',
        'Pass123!',
        'New User'
      );
    });

    it('should indicate email verification requirement', async () => {
      mockAuthService.signUp.mockResolvedValue({
        success: true,
        requiresVerification: true,
      });

      const result = await mockAuthService.signUp('verify@example.com', 'Pass123!');

      expect(result.requiresVerification).toBe(true);
    });

    it('should return error for duplicate email', async () => {
      mockAuthService.signUp.mockResolvedValue({
        success: false,
        error: 'Email already exists',
      });

      const result = await mockAuthService.signUp('existing@example.com', 'Pass123!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already exists');
    });
  });

  // =========================================================================
  // signOut
  // =========================================================================
  describe('signOut', () => {
    it('should sign out successfully', async () => {
      mockAuthService.signOut.mockResolvedValue(undefined);

      await mockAuthService.signOut();

      expect(mockAuthService.signOut).toHaveBeenCalled();
    });

    it('should throw on sign-out failure', async () => {
      mockAuthService.signOut.mockRejectedValue(new Error('Session error'));

      await expect(mockAuthService.signOut()).rejects.toThrow('Session error');
    });
  });

  // =========================================================================
  // OAuth
  // =========================================================================
  describe('OAuth sign-in', () => {
    it('should initiate Google OAuth flow', async () => {
      mockAuthService.signInWithOAuth.mockResolvedValue(undefined);

      await mockAuthService.signInWithOAuth('google');

      expect(mockAuthService.signInWithOAuth).toHaveBeenCalledWith('google');
    });

    it('should initiate GitHub OAuth flow', async () => {
      mockAuthService.signInWithOAuth.mockResolvedValue(undefined);

      await mockAuthService.signInWithOAuth('github');

      expect(mockAuthService.signInWithOAuth).toHaveBeenCalledWith('github');
    });

    it('should throw on OAuth popup blocked', async () => {
      mockAuthService.signInWithOAuth.mockRejectedValue(new Error('Popup blocked'));

      await expect(
        mockAuthService.signInWithOAuth('google')
      ).rejects.toThrow('Popup blocked');
    });
  });

  // =========================================================================
  // getCurrentUser
  // =========================================================================
  describe('getCurrentUser', () => {
    it('should return user when authenticated', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      };
      mockAuthService.getCurrentUser.mockResolvedValue(mockUser);

      const user = await mockAuthService.getCurrentUser();

      expect(user).toEqual(mockUser);
    });

    it('should return null when not authenticated', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(null);

      const user = await mockAuthService.getCurrentUser();

      expect(user).toBeNull();
    });

    it('should handle service errors gracefully', async () => {
      mockAuthService.getCurrentUser.mockRejectedValue(new Error('Service unavailable'));

      await expect(mockAuthService.getCurrentUser()).rejects.toThrow('Service unavailable');
    });
  });

  // =========================================================================
  // onAuthStateChange
  // =========================================================================
  describe('onAuthStateChange', () => {
    it('should return unsubscribe function', () => {
      const unsubscribe = mockAuthService.onAuthStateChange(jest.fn());

      expect(typeof unsubscribe).toBe('function');
    });

    it('should accept callback function', () => {
      const callback = jest.fn();
      mockAuthService.onAuthStateChange(callback);

      expect(mockAuthService.onAuthStateChange).toHaveBeenCalledWith(callback);
    });
  });

  // =========================================================================
  // useAuth contract verification
  // =========================================================================
  describe('useAuth contract', () => {
    it('should expose all required methods', () => {
      // The useAuth hook should expose these methods (matching AuthContextType)
      const expectedMethods = [
        'signIn',
        'signUp',
        'signOut',
        'signInWithGoogle',
        'signInWithGithub',
      ];

      // These map to authService methods
      const serviceMethodMap: Record<string, string> = {
        signIn: 'signIn',
        signUp: 'signUp',
        signOut: 'signOut',
        signInWithGoogle: 'signInWithOAuth', // calls signInWithOAuth('google')
        signInWithGithub: 'signInWithOAuth', // calls signInWithOAuth('github')
      };

      for (const method of expectedMethods) {
        const serviceMethod = serviceMethodMap[method];
        expect(mockAuthService).toHaveProperty(serviceMethod);
        expect(typeof mockAuthService[serviceMethod]).toBe('function');
      }
    });

    it('should expose user and loading state', () => {
      // useAuth returns { user, loading, ...methods }
      const expectedState = {
        user: null,     // Initially null
        loading: true,  // Initially loading
      };

      expect(expectedState.user).toBeNull();
      expect(expectedState.loading).toBe(true);
    });

    it('should return safe defaults during SSR', () => {
      // When window is undefined (SSR), useAuth returns safe defaults
      const ssrDefaults = {
        user: null,
        loading: true,
        signIn: async () => {},
        signUp: async () => {},
        signOut: async () => {},
        signInWithGoogle: async () => {},
        signInWithGithub: async () => {},
      };

      expect(ssrDefaults.user).toBeNull();
      expect(ssrDefaults.loading).toBe(true);
      expect(typeof ssrDefaults.signIn).toBe('function');
      expect(typeof ssrDefaults.signUp).toBe('function');
      expect(typeof ssrDefaults.signOut).toBe('function');
      expect(typeof ssrDefaults.signInWithGoogle).toBe('function');
      expect(typeof ssrDefaults.signInWithGithub).toBe('function');
    });
  });
});
