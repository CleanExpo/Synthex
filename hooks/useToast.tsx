/**
 * Toast notification hook
 * Provides easy API for showing notifications
 */

import { toast as sonnerToast } from 'sonner';

export function useToast() {
  const toast = {
    success: (message: string, description?: string) => {
      sonnerToast.success(message, {
        description,
        duration: 4000,
      });
    },
    
    error: (message: string, description?: string) => {
      sonnerToast.error(message, {
        description,
        duration: 5000,
      });
    },
    
    info: (message: string, description?: string) => {
      sonnerToast.info(message, {
        description,
        duration: 4000,
      });
    },
    
    warning: (message: string, description?: string) => {
      sonnerToast.warning(message, {
        description,
        duration: 4000,
      });
    },
    
    loading: (message: string) => {
      return sonnerToast.loading(message);
    },
    
    promise: <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      }
    ) => {
      return sonnerToast.promise(promise, messages);
    },
    
    custom: (content: React.ReactNode, options?: any) => {
      sonnerToast.custom(content, options);
    },
    
    dismiss: (id?: string | number) => {
      sonnerToast.dismiss(id);
    },
  };
  
  return toast;
}

// Export for direct usage
export const toast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, { description });
  },
  error: (message: string, description?: string) => {
    sonnerToast.error(message, { description });
  },
  info: (message: string, description?: string) => {
    sonnerToast.info(message, { description });
  },
  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, { description });
  },
  loading: (message: string) => sonnerToast.loading(message),
  promise: sonnerToast.promise,
  custom: sonnerToast.custom,
  dismiss: sonnerToast.dismiss,
};