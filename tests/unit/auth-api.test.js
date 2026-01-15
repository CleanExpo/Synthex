/**
 * Unit tests for AuthAPI class
 */

// Mock fetch globally
global.fetch = jest.fn();
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true
});
Object.defineProperty(global, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true
});
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
  configurable: true
});

// Import after mocking
const AuthAPI = require('../../public/js/auth-api.js');

describe('AuthAPI', () => {
  let authAPI;

  beforeEach(() => {
    authAPI = new AuthAPI();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct base URL for localhost', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true
      });
      
      const api = new AuthAPI();
      expect(api.baseURL).toBe('http://localhost:3000/api/v1');
    });

    it('should initialize with correct base URL for production', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'synthex.social' },
        writable: true
      });
      
      const api = new AuthAPI();
      expect(api.baseURL).toBe('/api/v1');
    });

    it('should load tokens from localStorage', () => {
      localStorage.getItem.mockImplementation((key) => {
        if (key === 'synthex_token') return 'test-token';
        if (key === 'synthex_refresh_token') return 'test-refresh-token';
        return null;
      });
      
      const api = new AuthAPI();
      expect(api.token).toBe('test-token');
      expect(api.refreshToken).toBe('test-refresh-token');
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        success: true,
        data: {
          token: 'new-token',
          refreshToken: 'new-refresh-token',
          user: { id: '1', email: 'test@example.com' }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await authAPI.login('test@example.com', 'password123');
      
      expect(result).toEqual(mockResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('synthex_token', 'new-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('synthex_refresh_token', 'new-refresh-token');
    });

    it('should handle login failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid credentials' })
      });

      await expect(authAPI.login('test@example.com', 'wrong-password'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const mockResponse = {
        success: true,
        data: {
          token: 'new-token',
          refreshToken: 'new-refresh-token',
          user: { id: '1', email: 'test@example.com', name: 'Test User' }
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await authAPI.register('Test User', 'test@example.com', 'password123');
      
      expect(result).toEqual(mockResponse);
      expect(localStorage.setItem).toHaveBeenCalledWith('synthex_token', 'new-token');
    });

    it('should handle registration failure', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Email already exists' })
      });

      await expect(authAPI.register('Test User', 'test@example.com', 'password123'))
        .rejects.toThrow('Email already exists');
    });
  });

  describe('logout', () => {
    it('should clear tokens and call logout endpoint', async () => {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });

      await authAPI.logout();
      
      expect(localStorage.removeItem).toHaveBeenCalledWith('synthex_token');
      expect(localStorage.removeItem).toHaveBeenCalledWith('synthex_refresh_token');
      expect(authAPI.token).toBeNull();
      expect(authAPI.refreshToken).toBeNull();
    });
  });

  describe('refreshAccessToken', () => {
    it('should refresh the access token', async () => {
      authAPI.refreshToken = 'old-refresh-token';
      
      const mockResponse = {
        success: true,
        data: {
          token: 'new-access-token',
          refreshToken: 'new-refresh-token'
        }
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await authAPI.refreshAccessToken();
      
      expect(result).toEqual(mockResponse);
      expect(authAPI.token).toBe('new-access-token');
      expect(localStorage.setItem).toHaveBeenCalledWith('synthex_token', 'new-access-token');
    });

    it('should handle refresh token failure', async () => {
      authAPI.refreshToken = 'invalid-refresh-token';
      
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid refresh token' })
      });

      await expect(authAPI.refreshAccessToken())
        .rejects.toThrow('Invalid refresh token');
    });
  });

  describe('makeAuthenticatedRequest', () => {
    it('should make request with auth header', async () => {
      authAPI.token = 'test-token';
      
      const mockResponse = { data: 'test' };
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const result = await authAPI.makeAuthenticatedRequest('/test');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should retry with refreshed token on 401', async () => {
      authAPI.token = 'expired-token';
      authAPI.refreshToken = 'valid-refresh-token';
      
      // First call fails with 401
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expired' })
      });
      
      // Refresh token call succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { token: 'new-token', refreshToken: 'new-refresh-token' }
        })
      });
      
      // Retry succeeds
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'success' })
      });

      const result = await authAPI.makeAuthenticatedRequest('/test');
      
      expect(result).toEqual({ data: 'success' });
      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(authAPI.validateEmail('test@example.com')).toBe(true);
      expect(authAPI.validateEmail('user.name@company.co.uk')).toBe(true);
      expect(authAPI.validateEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(authAPI.validateEmail('notanemail')).toBe(false);
      expect(authAPI.validateEmail('@example.com')).toBe(false);
      expect(authAPI.validateEmail('user@')).toBe(false);
      expect(authAPI.validateEmail('user @example.com')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should validate strong passwords', () => {
      expect(authAPI.validatePassword('Password123!')).toBe(true);
      expect(authAPI.validatePassword('Str0ng&Secure')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(authAPI.validatePassword('weak')).toBe(false);
      expect(authAPI.validatePassword('12345678')).toBe(false);
      expect(authAPI.validatePassword('password')).toBe(false);
      expect(authAPI.validatePassword('PASSWORD123')).toBe(false); // No lowercase
    });
  });
});
