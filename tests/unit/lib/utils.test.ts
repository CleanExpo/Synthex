/**
 * Utils Unit Tests
 *
 * @description Tests for utility functions
 */

import { cn, getErrorMessage, isError } from '@/lib/utils';

describe('cn (className utility)', () => {
  it('should merge simple class names', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const result = cn('base', true && 'conditional', false && 'excluded');
    expect(result).toBe('base conditional');
  });

  it('should handle arrays of classes', () => {
    const result = cn(['class1', 'class2'], 'class3');
    expect(result).toBe('class1 class2 class3');
  });

  it('should handle objects with boolean values', () => {
    const result = cn({ active: true, disabled: false, 'text-red': true });
    expect(result).toBe('active text-red');
  });

  it('should merge Tailwind classes properly', () => {
    const result = cn('p-4', 'p-2');
    // twMerge should prefer the last value
    expect(result).toBe('p-2');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should handle null and undefined', () => {
    const result = cn('base', null, undefined, 'end');
    expect(result).toBe('base end');
  });

  it('should merge conflicting Tailwind utilities', () => {
    const result = cn('text-red-500', 'text-blue-500');
    expect(result).toBe('text-blue-500');
  });

  it('should handle complex nested structures', () => {
    const isActive = true;
    const result = cn(
      'base-class',
      ['array-class'],
      { 'conditional-true': true, 'conditional-false': false },
      isActive && 'active-class'
    );
    expect(result).toContain('base-class');
    expect(result).toContain('array-class');
    expect(result).toContain('conditional-true');
    expect(result).not.toContain('conditional-false');
    expect(result).toContain('active-class');
  });
});

describe('getErrorMessage', () => {
  it('should extract message from Error instance', () => {
    const error = new Error('Test error message');
    const result = getErrorMessage(error);
    expect(result).toBe('Test error message');
  });

  it('should return string error directly', () => {
    const error = 'String error';
    const result = getErrorMessage(error);
    expect(result).toBe('String error');
  });

  it('should extract message from error-like object', () => {
    const error = { message: 'Object error message' };
    const result = getErrorMessage(error);
    expect(result).toBe('Object error message');
  });

  it('should handle null', () => {
    const result = getErrorMessage(null);
    expect(result).toBe('An unknown error occurred');
  });

  it('should handle undefined', () => {
    const result = getErrorMessage(undefined);
    expect(result).toBe('An unknown error occurred');
  });

  it('should handle number', () => {
    const result = getErrorMessage(404);
    expect(result).toBe('An unknown error occurred');
  });

  it('should handle object without message property', () => {
    const error = { code: 'ERR_001', status: 500 };
    const result = getErrorMessage(error);
    expect(result).toBe('An unknown error occurred');
  });

  it('should handle TypeError', () => {
    const error = new TypeError('Cannot read property');
    const result = getErrorMessage(error);
    expect(result).toBe('Cannot read property');
  });

  it('should handle custom error classes', () => {
    class CustomError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'CustomError';
      }
    }
    const error = new CustomError('Custom error message');
    const result = getErrorMessage(error);
    expect(result).toBe('Custom error message');
  });

  it('should stringify non-string message properties', () => {
    const error = { message: 123 };
    const result = getErrorMessage(error);
    expect(result).toBe('123');
  });
});

describe('isError', () => {
  it('should return true for Error instance', () => {
    const error = new Error('Test');
    expect(isError(error)).toBe(true);
  });

  it('should return true for TypeError', () => {
    const error = new TypeError('Type error');
    expect(isError(error)).toBe(true);
  });

  it('should return true for RangeError', () => {
    const error = new RangeError('Range error');
    expect(isError(error)).toBe(true);
  });

  it('should return true for SyntaxError', () => {
    const error = new SyntaxError('Syntax error');
    expect(isError(error)).toBe(true);
  });

  it('should return false for string', () => {
    expect(isError('error string')).toBe(false);
  });

  it('should return false for error-like object', () => {
    const fakeError = { message: 'Fake', name: 'Error' };
    expect(isError(fakeError)).toBe(false);
  });

  it('should return false for null', () => {
    expect(isError(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isError(undefined)).toBe(false);
  });

  it('should return false for number', () => {
    expect(isError(500)).toBe(false);
  });

  it('should work as type guard in TypeScript', () => {
    const maybeError: unknown = new Error('Test');
    if (isError(maybeError)) {
      // TypeScript should recognize this as Error type
      expect(maybeError.message).toBe('Test');
      expect(maybeError.stack).toBeDefined();
    }
  });

  it('should return true for custom Error subclass', () => {
    class CustomError extends Error {}
    const error = new CustomError('Custom');
    expect(isError(error)).toBe(true);
  });
});
