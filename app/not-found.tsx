'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, Home, ArrowLeft } from '@/components/icons';
import { fadeInUp, float } from '@/lib/animations';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotFound() {
  const router = useRouter();
  
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={fadeInUp}
        className="max-w-lg w-full"
      >
        <Card variant="glass" className="p-8 text-center">
          {/* Animated 404 */}
          <motion.div
            animate={float}
            className="mb-6"
          >
            <div className="text-8xl font-bold gradient-text">
              404
            </div>
          </motion.div>
          
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 bg-cyan-500/20 rounded-full flex items-center justify-center">
            <Search className="h-10 w-10 text-cyan-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">
            Page Not Found
          </h1>
          
          <p className="text-gray-400 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          
          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Button
              onClick={() => router.back()}
              variant="outline"
              className="bg-white/5 border-white/10"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
            
            <Button
              onClick={() => router.push('/dashboard')}
              className="gradient-primary"
            >
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </div>
          
          {/* Helpful links */}
          <div className="pt-6 border-t border-white/10">
            <p className="text-sm text-gray-400 mb-4">
              Here are some helpful links:
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <Link href="/create" className="text-cyan-400 hover:text-cyan-300 text-sm">
                Create Content
              </Link>
              <span className="text-gray-600">•</span>
              <Link href="/analytics" className="text-cyan-400 hover:text-cyan-300 text-sm">
                Analytics
              </Link>
              <span className="text-gray-600">•</span>
              <Link href="/schedule" className="text-cyan-400 hover:text-cyan-300 text-sm">
                Schedule
              </Link>
              <span className="text-gray-600">•</span>
              <Link href="/settings" className="text-cyan-400 hover:text-cyan-300 text-sm">
                Settings
              </Link>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}