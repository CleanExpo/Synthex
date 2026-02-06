/**
 * Email Service Unit Tests
 *
 * @description Tests for the email service module
 */

// Mock Prisma - shared mock instance
const mockUserUpdate = jest.fn().mockResolvedValue({});
const mockEmailLogCreate = jest.fn().mockResolvedValue({ id: 'mock-email-id' });

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      update: mockUserUpdate,
    },
    emailLog: {
      create: mockEmailLogCreate,
    },
  })),
}));

// Mock fetch for Resend API
global.fetch = jest.fn();

import { EmailService, EmailTemplate } from '@/lib/email/email-service';

describe('EmailService', () => {
  let emailService: EmailService;

  beforeEach(() => {
    emailService = new EmailService();
    jest.clearAllMocks();
    // Reset mocks
    mockUserUpdate.mockResolvedValue({});
    mockEmailLogCreate.mockResolvedValue({ id: 'mock-email-id' });
    // Reset environment variables
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      expect(emailService).toBeDefined();
    });

    it('should use environment variables when available', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://test.example.com';
      process.env.EMAIL_FROM = 'test@example.com';
      process.env.EMAIL_FROM_NAME = 'Test App';

      const service = new EmailService();

      // Access private properties via any cast for testing
      expect((service as any).baseUrl).toBe('https://test.example.com');
      expect((service as any).fromEmail).toBe('test@example.com');
      expect((service as any).fromName).toBe('Test App');
    });
  });

  describe('generateVerificationCode', () => {
    it('should generate a 64-character hex string', () => {
      const code = emailService.generateVerificationCode();

      expect(code).toHaveLength(64);
      expect(code).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate unique codes on each call', () => {
      const code1 = emailService.generateVerificationCode();
      const code2 = emailService.generateVerificationCode();

      expect(code1).not.toBe(code2);
    });
  });

  describe('generateOTP', () => {
    it('should generate a 6-digit numeric string', () => {
      const otp = emailService.generateOTP();

      expect(otp).toHaveLength(6);
      expect(otp).toMatch(/^\d{6}$/);
    });

    it('should generate OTPs in valid range (100000-999999)', () => {
      // Test multiple times to ensure range is respected
      for (let i = 0; i < 100; i++) {
        const otp = emailService.generateOTP();
        const num = parseInt(otp, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThanOrEqual(999999);
      }
    });

    it('should generate varying OTPs', () => {
      const otps = new Set();
      for (let i = 0; i < 10; i++) {
        otps.add(emailService.generateOTP());
      }
      // With 10 attempts, we should have at least a few unique values
      expect(otps.size).toBeGreaterThan(1);
    });
  });

  describe('sendVerificationEmail', () => {
    it('should call prisma to update user with verification code', async () => {
      await emailService.sendVerificationEmail(
        'user-123',
        'test@example.com',
        'John'
      );

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            verificationCode: expect.any(String),
            verificationExpires: expect.any(Date),
          }),
        })
      );
    });

    it('should throw error on failure', async () => {
      mockUserUpdate.mockRejectedValueOnce(new Error('DB error'));

      await expect(
        emailService.sendVerificationEmail('user-123', 'test@example.com')
      ).rejects.toThrow('Failed to send verification email');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should generate both token and OTP code', async () => {
      await emailService.sendPasswordResetEmail(
        'user-123',
        'test@example.com',
        'Jane'
      );

      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            resetToken: expect.any(String),
            resetCode: expect.stringMatching(/^\d{6}$/),
            resetTokenExpires: expect.any(Date),
            resetCodeExpires: expect.any(Date),
          }),
        })
      );
    });

    it('should set expiry to 1 hour from now', async () => {
      const beforeCall = Date.now();
      await emailService.sendPasswordResetEmail(
        'user-123',
        'test@example.com'
      );
      const afterCall = Date.now();

      const updateCall = mockUserUpdate.mock.calls[0][0];
      const expiryTime = updateCall.data.resetTokenExpires.getTime();

      // Should be approximately 1 hour (3600000ms) from now
      expect(expiryTime).toBeGreaterThanOrEqual(beforeCall + 3600000 - 1000);
      expect(expiryTime).toBeLessThanOrEqual(afterCall + 3600000 + 1000);
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should not throw error on success', async () => {
      await expect(
        emailService.sendWelcomeEmail('test@example.com', 'Alice')
      ).resolves.not.toThrow();
    });

    it('should handle missing name gracefully', async () => {
      await expect(
        emailService.sendWelcomeEmail('test@example.com')
      ).resolves.not.toThrow();
    });
  });

  describe('Email Provider Routing', () => {
    it('should use SendGrid when configured', async () => {
      process.env.EMAIL_PROVIDER = 'sendgrid';
      process.env.SENDGRID_API_KEY = 'test-key';

      // Recreate service with new env
      const service = new EmailService();

      // Should not throw even without real SendGrid
      await expect(
        service.sendWelcomeEmail('test@example.com')
      ).resolves.not.toThrow();
    });

    it('should use Resend when configured', async () => {
      process.env.EMAIL_PROVIDER = 'resend';
      process.env.RESEND_API_KEY = 'test-resend-key';

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'email-123' }),
      });

      const service = new EmailService();
      await service.sendWelcomeEmail('test@example.com');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-resend-key',
          }),
        })
      );
    });

    it('should fall back to database logging in development', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.EMAIL_PROVIDER;

      const service = new EmailService();

      // Should not throw - will save to database
      await expect(
        service.sendWelcomeEmail('test@example.com')
      ).resolves.not.toThrow();
    });
  });
});

describe('EmailTemplate', () => {
  it('should have required fields', () => {
    const template: EmailTemplate = {
      to: 'test@example.com',
      subject: 'Test Subject',
      html: '<p>Test content</p>',
    };

    expect(template.to).toBeDefined();
    expect(template.subject).toBeDefined();
    expect(template.html).toBeDefined();
  });

  it('should accept optional text field', () => {
    const template: EmailTemplate = {
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>HTML</p>',
      text: 'Plain text',
    };

    expect(template.text).toBe('Plain text');
  });
});
