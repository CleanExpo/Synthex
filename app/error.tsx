'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, ChevronLeft } from '@/components/icons';
import { fadeInUp, scaleIn } from '@/lib/animations';
import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  
  useEffect(() => {
    // Log error to error reporting service
    console.error('Application error:', error);
  }, [error]);
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="max-w-lg w-full"
      >
        <Card variant="glass" className="p-8 text-center">
          <motion.div
            variants={scaleIn}
            className="mb-6"
          >
            <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
          </motion.div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            Oops! Something went wrong
          </h1>
          
          <p className="text-gray-400 mb-6">
            We encountered an unexpected error. Don't worry, we're on it!
          </p>
          
          {error.message && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-300 font-mono">
                {error.message}
              </p>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={reset}
              className="gradient-primary"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            
            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="bg-white/5 border-white/10"
            >
              <Home className="h-4 w-4 mr-2" />
              Go Home
            </Button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-gray-500">
              Error ID: {error.digest || 'Unknown'}
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}