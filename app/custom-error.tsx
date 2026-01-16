/**
 * Custom error page component
 * Provides friendly error messages and recovery options
 */

'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  AlertCircle, 
  Home, 
  RefreshCw, 
  ArrowLeft,
  Bug,
  Wifi,
  Shield,
  Clock,
  Database,
  Search
} from '@/components/icons';
import { useRouter } from 'next/navigation';
import { fadeInUp, popIn } from '@/lib/animations';

interface ErrorPageProps {
  statusCode?: number;
  title?: string;
  message?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  showRetryButton?: boolean;
  onRetry?: () => void;
}

// Error type configurations
const errorConfigs = {
  400: {
    icon: AlertCircle,
    title: 'Bad Request',
    message: 'The request could not be understood. Please check your input and try again.',
    color: 'text-orange-400'
  },
  401: {
    icon: Shield,
    title: 'Authentication Required',
    message: 'Please log in to access this resource.',
    color: 'text-yellow-400'
  },
  403: {
    icon: Shield,
    title: 'Access Denied',
    message: 'You don\'t have permission to access this resource.',
    color: 'text-red-400'
  },
  404: {
    icon: Search,
    title: 'Page Not Found',
    message: 'The page you\'re looking for doesn\'t exist or has been moved.',
    color: 'text-blue-400'
  },
  408: {
    icon: Clock,
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.',
    color: 'text-yellow-400'
  },
  500: {
    icon: Bug,
    title: 'Server Error',
    message: 'Something went wrong on our end. We\'re working to fix it.',
    color: 'text-red-400'
  },
  502: {
    icon: Wifi,
    title: 'Bad Gateway',
    message: 'We\'re having trouble connecting to our servers. Please try again.',
    color: 'text-orange-400'
  },
  503: {
    icon: Database,
    title: 'Service Unavailable',
    message: 'Our service is temporarily unavailable. Please check back soon.',
    color: 'text-purple-400'
  }
};

export function CustomErrorPage({
  statusCode = 500,
  title,
  message,
  showBackButton = true,
  showHomeButton = true,
  showRetryButton = true,
  onRetry
}: ErrorPageProps) {
  const router = useRouter();
  const config = errorConfigs[statusCode as keyof typeof errorConfigs] || errorConfigs[500];
  const Icon = config.icon;
  
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="max-w-md w-full"
      >
        <Card className="glass-card p-8 text-center">
          {/* Error icon */}
          <motion.div
            variants={popIn}
            className="mb-6 flex justify-center"
          >
            <div className={`p-4 rounded-full bg-white/5 ${config.color}`}>
              <Icon className="h-16 w-16" />
            </div>
          </motion.div>
          
          {/* Status code */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4"
          >
            <span className="text-6xl font-bold text-white/20">{statusCode}</span>
          </motion.div>
          
          {/* Error title */}
          <h1 className="text-2xl font-bold text-white mb-3">
            {title || config.title}
          </h1>
          
          {/* Error message */}
          <p className="text-gray-400 mb-8">
            {message || config.message}
          </p>
          
          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {showRetryButton && (
              <Button
                onClick={handleRetry}
                variant="default"
                className="group"
              >
                <RefreshCw className="h-4 w-4 mr-2 group-hover:rotate-180 transition-transform duration-500" />
                Try Again
              </Button>
            )}
            
            {showBackButton && (
              <Button
                onClick={() => router.back()}
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            )}
            
            {showHomeButton && (
              <Button
                onClick={() => router.push('/')}
                variant="outline"
              >
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            )}
          </div>
          
          {/* Help text */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-sm text-gray-500">
              Error ID: {generateErrorId()}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              If this problem persists, please contact support
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

// Generate unique error ID for tracking
function generateErrorId() {
  return `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}

// 404 Page Component
export function NotFoundPage() {
  return (
    <CustomErrorPage
      statusCode={404}
      showRetryButton={false}
    />
  );
}

// 500 Page Component
export function ServerErrorPage() {
  return (
    <CustomErrorPage
      statusCode={500}
    />
  );
}

// 403 Page Component
export function ForbiddenPage() {
  return (
    <CustomErrorPage
      statusCode={403}
      showRetryButton={false}
    />
  );
}

// Maintenance Page
export function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="max-w-md w-full"
      >
        <Card className="glass-card p-8 text-center">
          <motion.div
            variants={popIn}
            className="mb-6 flex justify-center"
          >
            <div className="p-4 rounded-full bg-white/5 text-purple-400">
              <Database className="h-16 w-16" />
            </div>
          </motion.div>
          
          <h1 className="text-2xl font-bold text-white mb-3">
            Under Maintenance
          </h1>
          
          <p className="text-gray-400 mb-8">
            We're upgrading our systems to serve you better. 
            We'll be back online shortly!
          </p>
          
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-400 mb-2">Expected downtime:</p>
            <p className="text-lg font-semibold text-white">30 minutes</p>
          </div>
          
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Again
          </Button>
        </Card>
      </motion.div>
    </div>
  );
}