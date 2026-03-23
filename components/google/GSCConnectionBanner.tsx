'use client';

import { Button } from '@/components/ui/button';
import { Globe, ExternalLink } from '@/components/icons';

interface GSCConnectionBannerProps {
  onConnect?: () => void;
}

export function GSCConnectionBanner({ onConnect }: GSCConnectionBannerProps) {
  const handleConnect = () => {
    if (onConnect) {
      onConnect();
      return;
    }
    // Default: open OAuth flow
    window.open(
      `/api/auth/oauth/searchconsole?returnTo=${encodeURIComponent(window.location.pathname)}`,
      '_blank',
      'width=600,height=700'
    );
  };

  return (
    <div className="p-6 bg-gradient-to-r from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-orange-500/10 rounded-lg">
          <Globe className="w-6 h-6 text-orange-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">
            Connect Google Search Console
          </h3>
          <p className="text-sm text-gray-300 mb-4">
            Connect your Google account to access per-site search analytics, URL
            indexing, coverage reports, and sitemap management directly from
            Synthex.
          </p>
          <Button
            onClick={handleConnect}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Connect Google Search Console
          </Button>
        </div>
      </div>
    </div>
  );
}
