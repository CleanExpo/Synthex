'use client';

import { Button } from '@/components/ui/button';
import { Map, ExternalLink } from '@/components/icons';

interface GBPConnectionBannerProps {
  onConnect?: () => void;
}

export function GBPConnectionBanner({ onConnect }: GBPConnectionBannerProps) {
  const handleConnect = () => {
    if (onConnect) {
      onConnect();
      return;
    }
    window.open(
      `/api/auth/oauth/googlebusiness?returnTo=${encodeURIComponent(window.location.pathname)}`,
      '_blank',
      'width=600,height=700'
    );
  };

  return (
    <div className="p-6 bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-orange-500/10 rounded-lg">
          <Map className="w-6 h-6 text-orange-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">
            Connect Google Business Profile
          </h3>
          <p className="text-sm text-gray-300 mb-4">
            Connect your Google account to manage your business listings,
            respond to reviews, post updates, and track local search performance
            — all from Synthex.
          </p>
          <Button
            onClick={handleConnect}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect Google Business Profile
          </Button>
        </div>
      </div>
    </div>
  );
}
