import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sparkles } from '@/components/icons';

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <nav className="fixed top-0 w-full z-50 glass-card border-b">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <Sparkles className="w-8 h-8 text-purple-500" />
              <span className="text-2xl font-bold gradient-text">Synthex</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="text-gray-300 hover:text-white">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>
      <div className="pt-32 pb-20 px-6">
        <div className="container mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-6">Changelog</h1>
          <p className="text-xl text-gray-300">Coming soon</p>
        </div>
      </div>
    </div>
  );
}