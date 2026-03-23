'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGSCProperties } from '@/hooks/useGSCProperties';
import { GSCConnectionBanner } from '@/components/google/GSCConnectionBanner';
import {
  ArrowLeft,
  Globe,
  RefreshCw,
  Loader2,
  CheckCircle,
  Star,
} from '@/components/icons';
import { useState } from 'react';

export default function GSCPropertiesPage() {
  const { properties, isLoading, error, syncProperties } = useGSCProperties();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncProperties();
    } catch {
      // Error handled by hook
    } finally {
      setSyncing(false);
    }
  };

  const hasConnection = properties.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/seo/search-console"
          className="text-sm text-gray-300 hover:text-orange-400 flex items-center gap-1 mb-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Search Console
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <Globe className="w-7 h-7 text-orange-400" />
              GSC Properties
            </h1>
            <p className="text-gray-300 mt-1">
              Manage your connected Google Search Console properties
            </p>
          </div>
          {hasConnection && (
            <Button
              onClick={handleSync}
              disabled={syncing}
              variant="outline"
              className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Sync from Google
            </Button>
          )}
        </div>
      </div>

      {!hasConnection && !isLoading && <GSCConnectionBanner />}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {properties.map(property => (
            <Card
              key={property.id}
              className="bg-surface-base/80 backdrop-blur-xl border border-orange-500/10"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="w-5 h-5 text-orange-400" />
                    <div>
                      <p className="text-white font-medium">
                        {property.siteUrl}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {property.permissionLevel
                          ?.replace(/([A-Z])/g, ' $1')
                          .trim() || 'Unknown permission'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {property.isPrimary && (
                      <span className="flex items-center gap-1 px-2 py-1 bg-orange-500/10 text-orange-400 rounded-full text-xs font-medium">
                        <Star className="w-3 h-3" />
                        Primary
                      </span>
                    )}
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  </div>
                </div>
                {property.lastSyncedAt && (
                  <p className="text-xs text-gray-500 mt-2">
                    Last synced:{' '}
                    {new Date(property.lastSyncedAt).toLocaleString()}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
