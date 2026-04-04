/**
 * User Validator Implementation
 * Provides comprehensive validation for user-related operations
 */

import { 
  IValidator, 
  ValidationResult, 
  ValidationError 
} from '../../architecture/layer-interfaces';

export interface CreateUserValidationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
  permissions?: string[];
  tenantId?: string;
}

export interface UpdateUserValidationData {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  permissions?: string[];
  isActive?: boolean;
}

export class UserValidator implements IValidator {
  private readonly validRoles = ['user', 'admin', 'moderator', 'editor'];
  private readonly validPermissions = [
    'user:read',
    'user:create',
    'user:update',
    'user:delete',
    'user:admin',
    'user:list',
    'user:statistics',
    'content:read',
    'content:create',
    'content:update',
    'content:delete',
    'analytics:read',
    'settings:read',
    'settings:update'
  ];

  /**
   * Validate user data
   */
  async validate(data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!data || typeof data !== 'object') {
      errors.push({
        field: 'data',
        message: 'Invalid data format',
        code: 'INVALID_DATA_FORMAT'
      });
      return { isValid: false, errors };
    }

    // Determine validation type based on presence of ID
    if (data.id) {
      return this.validateUpdateUser(data as UpdateUserValidationData);
    } else {
      return this.validateCreateUser(data as CreateUserValidationData);
    }
  }

  /**
   * Validate user creation data
   */
  private validateCreateUser(data: CreateUserValidationData): ValidationResult {
    const errors: ValidationError[] = [];

    // Email validation
    if (!data.email) {
      errors.push({
        field: 'email',
        message: 'Email is required',
        code: 'REQUIRED_FIELD'
      });
    } else if (!this.isValidEmail(data.email)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL_FORMAT'
      });
    }

    // Password validation
    const passwordValidation = this.validatePassword(data.password);
    if (!passwordValidation.isValid) {
      errors.push({
        field: 'password',
        message: passwordValidation.message,
        code: passwordValidation.code
      });
    }

    // First name validation
    if (!data.firstName) {
      errors.push({
        field: 'firstName',
        message: 'First name is required',
        code: 'REQUIRED_FIELD'
      });
    } else if (!this.isValidName(data.firstName)) {
      errors.push({
        field: 'firstName',
        message: 'Invalid first name format',
        code: 'INVALID_NAME_FORMAT'
      });
    }

    // Last name validation
    if (!data.lastName) {
      errors.push({
        field: 'lastName',
        message: 'Last name is required',
        code: 'REQUIRED_FIELD'
      });
    } else if (!this.isValidName(data.lastName)) {
      errors.push({
        field: 'lastName',
        message: 'Invalid last name format',
        code: 'INVALID_NAME_FORMAT'
      });
    }

    // Role validation (optional)
    if (data.role && !this.isValidRole(data.role)) {
      errors.push({
        field: 'role',
        message: `Invalid role. Must be one of: ${this.validRoles.join(', ')}`,
        code: 'INVALID_ROLE'
      });
    }

    // Permissions validation (optional)
    if (data.permissions && !this.areValidPermissions(data.permissions)) {
      errors.push({
        field: 'permissions',
        message: `Invalid permissions. Valid permissions: ${this.validPermissions.join(', ')}`,
        code: 'INVALID_PERMISSIONS'
      });
    }

    // Tenant ID validation (optional)
    if (data.tenantId && !this.isValidUuid(data.tenantId)) {
      errors.push({
        field: 'tenantId',
        message: 'Invalid tenant ID format',
        code: 'INVALID_TENANT_ID'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate user update data
   */
  private validateUpdateUser(data: UpdateUserValidationData): ValidationResult {
    const errors: ValidationError[] = [];

    // ID validation (required for updates)
    if (!data.id) {
      errors.push({
        field: 'id',
        message: 'User ID is required for updates',
        code: 'REQUIRED_FIELD'
      });
    } else if (!this.isValidUuid(data.id)) {
      errors.push({
        field: 'id',
        message: 'Invalid user ID format',
        code: 'INVALID_USER_ID'
      });
    }

    // Email validation (optional for updates)
    if (data.email && !this.isValidEmail(data.email)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL_FORMAT'
      });
    }

    // First name validation (optional for updates)
    if (data.firstName && !this.isValidName(data.firstName)) {
      errors.push({
        field: 'firstName',
        message: 'Invalid first name format',
        code: 'INVALID_NAME_FORMAT'
      });
    }

    // Last name validation (optional for updates)
    if (data.lastName && !this.isValidName(data.lastName)) {
      errors.push({
        field: 'lastName',
        message: 'Invalid last name format',
        code: 'INVALID_NAME_FORMAT'
      });
    }

    // Role validation (optional for updates)
    if (data.role && !this.isValidRole(data.role)) {
      errors.push({
        field: 'role',
        message: `Invalid role. Must be one of: ${this.validRoles.join(', ')}`,
        code: 'INVALID_ROLE'
      });
    }

    // Permissions validation (optional for updates)
    if (data.permissions && !this.areValidPermissions(data.permissions)) {
      errors.push({
        field: 'permissions',
        message: `Invalid permissions. Valid permissions: ${this.validPermissions.join(', ')}`,
        code: 'INVALID_PERMISSIONS'
      });
    }

    // Active status validation (optional for updates)
    if (data.isActive !== undefined && typeof data.isActive !== 'boolean') {
      errors.push({
        field: 'isActive',
        message: 'isActive must be a boolean value',
        code: 'INVALID_BOOLEAN'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Validate password strength
   */
  private validatePassword(password: string): { isValid: boolean; message: string; code: string } {
    if (!password) {
      return {
        isValid: false,
        message: 'Password is required',
        code: 'REQUIRED_FIELD'
      };
    }

    if (password.length < 8) {
      return {
        isValid: false,
        message: 'Password must be at least 8 characters long',
        code: 'PASSWORD_TOO_SHORT'
      };
    }

    if (password.length > 128) {
      return {
        isValid: false,
        message: 'Password must be less than 128 characters long',
        code: 'PASSWORD_TOO_LONG'
      };
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one lowercase letter',
        code: 'PASSWORD_MISSING_LOWERCASE'
      };
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one uppercase letter',
        code: 'PASSWORD_MISSING_UPPERCASE'
      };
    }

    // Check for at least one number
    if (!/\d/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one number',
        code: 'PASSWORD_MISSING_NUMBER'
      };
    }

    // Check for at least one special character
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one special character',
        code: 'PASSWORD_MISSING_SPECIAL'
      };
    }

    // Check for common weak passwords
    const weakPasswords = [
      'password',
      '12345678',
      'qwerty123',
      'admin123',
      'letmein123',
      'welcome123'
    ];

    if (weakPasswords.includes(password.toLowerCase())) {
      return {
        isValid: false,
        message: 'Password is too common and weak',
        code: 'PASSWORD_TOO_WEAK'
      };
    }

    return {
      isValid: true,
      message: 'Password is valid',
      code: 'VALID_PASSWORD'
    };
  }

  /**
   * Validate name format
   */
  private isValidName(name: string): boolean {
    if (!name || typeof name !== 'string') {
      return false;
    }

    // Name should be 1-50 characters, letters, spaces, hyphens, and apostrophes only
    const nameRegex = /^[a-zA-Z\s\-']{1,50}$/;
    return nameRegex.test(name.trim());
  }

  /**
   * Validate role
   */
  private isValidRole(role: string): boolean {
    return this.validRoles.includes(role);
  }

  /**
   * Validate permissions array
   */
  private areValidPermissions(permissions: string[]): boolean {
    if (!Array.isArray(permissions)) {
      return false;
    }

    return permissions.every(permission => 
      this.validPermissions.includes(permission)
    );
  }

  /**
   * Validate UUID format
   */
  private isValidUuid(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Validate authentication data
   */
  async validateAuthentication(data: { email: string; password: string }): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    if (!data.email) {
      errors.push({
        field: 'email',
        message: 'Email is required',
        code: 'REQUIRED_FIELD'
      });
    } else if (!this.isValidEmail(data.email)) {
      errors.push({
        field: 'email',
        message: 'Invalid email format',
        code: 'INVALID_EMAIL_FORMAT'
      });
    }

    if (!data.password) {
      errors.push({
        field: 'password',
        message: 'Password is required',
        code: 'REQUIRED_FIELD'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get validation schema (for documentation/OpenAPI)
   */
  getValidationSchema(): any {
    return {
      createUser: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName'],
        properties: {
          email: {
            type: 'string',
            format: 'email',
            maxLength: 254
          },
          password: {
            type: 'string',
            minLength: 8,
            maxLength: 128,
            description: 'Must contain uppercase, lowercase, number, and special character'
          },
          firstName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            pattern: '^[a-zA-Z\\s\\-\']+$'
          },
          lastName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            pattern: '^[a-zA-Z\\s\\-\']+$'
          },
          role: {
            type: 'string',
            enum: this.validRoles
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string',
              enum: this.validPermissions
            }
          },
          tenantId: {
            type: 'string',
            format: 'uuid'
          }
        }
      },
      updateUser: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {
            type: 'string',
            format: 'uuid'
          },
          email: {
            type: 'string',
            format: 'email',
            maxLength: 254
          },
          firstName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            pattern: '^[a-zA-Z\\s\\-\']+$'
          },
          lastName: {
            type: 'string',
            minLength: 1,
            maxLength: 50,
            pattern: '^[a-zA-Z\\s\\-\']+$'
          },
          role: {
            type: 'string',
            enum: this.validRoles
          },
          permissions: {
            type: 'array',
            items: {
              type: 'string',
              enum: this.validPermissions
            }
          },
          isActive: {
            type: 'boolean'
          }
        }
      }
    };
  }
}