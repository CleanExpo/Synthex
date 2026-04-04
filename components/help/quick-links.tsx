'use client';

/**
 * Quick Links Section
 * Video tutorials, live chat, and documentation links
 */

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import {
  Video,
  MessageCircle,
  BookOpen,
  ChevronRight,
} from '@/components/icons';

export function QuickLinks() {
  const handleVideoClick = () => {
    window.open('https://www.youtube.com/@synthex', '_blank');
  };

  const handleChatClick = () => {
    type IntercomWindow = Window & { Intercom?: (action: string) => void };
    if (typeof window !== 'undefined' && (window as IntercomWindow).Intercom) {
      (window as IntercomWindow).Intercom!('show');
    } else {
      window.location.href =
        'mailto:support@synthex.social?subject=Support Request';
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
      <Card
        variant="glass"
        className="hover:scale-105 transition-transform cursor-pointer"
        onClick={handleVideoClick}
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/20">
              <Video className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Video Tutorials</h3>
              <p className="text-sm text-gray-300">
                Learn with step-by-step guides
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
          </div>
        </CardContent>
      </Card>

      <Card
        variant="glass"
        className="hover:scale-105 transition-transform cursor-pointer"
        onClick={handleChatClick}
      >
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/20">
              <MessageCircle className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Live Chat</h3>
              <p className="text-sm text-gray-300">
                Chat with our support team
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
          </div>
        </CardContent>
      </Card>

      <Card
        variant="glass"
        className="hover:scale-105 transition-transform cursor-pointer"
      >
        <Link href="/docs" className="block">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/20">
                <BookOpen className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Documentation</h3>
                <p className="text-sm text-gray-300">
                  Detailed technical guides
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
            </div>
          </CardContent>
        </Link>
      </Card>
    </div>
  );
}
