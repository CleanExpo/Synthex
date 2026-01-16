import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';
import { Input } from './input';
import { AlertCircle, CheckCircle } from '@/components/icons';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: boolean;
  helperText?: string;
  validation?: (value: string) => string | undefined;
}

export function FormField({
  label,
  error,
  success,
  helperText,
  validation,
  className,
  onChange,
  onBlur,
  required,
  ...props
}: FormFieldProps) {
  const [touched, setTouched] = React.useState(false);
  const [internalError, setInternalError] = React.useState<string>();
  const [value, setValue] = React.useState(props.value || '');
  
  const displayError = error || internalError;
  const hasError = touched && displayError;
  const showSuccess = touched && success && !hasError && value;
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    // Run validation if provided
    if (validation && touched) {
      const validationError = validation(newValue);
      setInternalError(validationError);
    }
    
    // Call original onChange if provided
    if (onChange) {
      onChange(e);
    }
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true);
    
    // Run validation on blur
    if (validation) {
      const validationError = validation(e.target.value);
      setInternalError(validationError);
    }
    
    // Call original onBlur if provided
    if (onBlur) {
      onBlur(e);
    }
  };
  
  const fieldId = props.id || label.toLowerCase().replace(/\s+/g, '-');
  const errorId = `${fieldId}-error`;
  const helperId = `${fieldId}-helper`;
  
  return (
    <div className="space-y-2">
      <Label 
        htmlFor={fieldId}
        className={cn(
          "text-sm font-medium",
          hasError && "text-red-500",
          showSuccess && "text-green-500"
        )}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      
      <div className="relative">
        <Input
          {...props}
          id={fieldId}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={cn(
            "pr-10",
            hasError && "border-red-500 focus:ring-red-500",
            showSuccess && "border-green-500 focus:ring-green-500",
            className
          )}
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={
            hasError ? errorId : helperText ? helperId : undefined
          }
          aria-required={required}
        />
        
        {/* Status Icons */}
        {hasError && (
          <AlertCircle 
            className="absolute right-3 top-3 w-4 h-4 text-red-500"
            aria-hidden="true"
          />
        )}
        {showSuccess && (
          <CheckCircle 
            className="absolute right-3 top-3 w-4 h-4 text-green-500"
            aria-hidden="true"
          />
        )}
      </div>
      
      {/* Error Message */}
      {hasError && (
        <p 
          id={errorId}
          className="text-sm text-red-500 flex items-center gap-1"
          role="alert"
        >
          {displayError}
        </p>
      )}
      
      {/* Helper Text */}
      {!hasError && helperText && (
        <p 
          id={helperId}
          className="text-sm text-gray-500"
        >
          {helperText}
        </p>
      )}
    </div>
  );
}

// Common validation functions
export const validators = {
  email: (value: string) => {
    if (!value) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Please enter a valid email address';
    }
    return undefined;
  },
  
  password: (value: string) => {
    if (!value) return 'Password is required';
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!/(?=.*[a-z])/.test(value)) return 'Password must contain a lowercase letter';
    if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain an uppercase letter';
    if (!/(?=.*\d)/.test(value)) return 'Password must contain a number';
    return undefined;
  },
  
  required: (message = 'This field is required') => (value: string) => {
    if (!value || !value.trim()) return message;
    return undefined;
  },
  
  minLength: (min: number) => (value: string) => {
    if (value.length < min) return `Must be at least ${min} characters`;
    return undefined;
  },
  
  maxLength: (max: number) => (value: string) => {
    if (value.length > max) return `Must be no more than ${max} characters`;
    return undefined;
  },
  
  url: (value: string) => {
    if (!value) return undefined;
    try {
      new URL(value);
      return undefined;
    } catch {
      return 'Please enter a valid URL';
    }
  },
};