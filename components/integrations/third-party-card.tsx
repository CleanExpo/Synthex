'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Unlink, Link2 } from '@/components/icons';
import type { ThirdPartyCardProps } from './types';
import { CATEGORY_BADGE_STYLES } from './types';

export function ThirdPartyCard({
  provider,
  name,
  description,
  icon: Icon,
  category,
  connected,
  loading,
  onConnect,
  onDisconnect,
  onConfigure,
}: ThirdPartyCardProps) {
  const categoryStyle = CATEGORY_BADGE_STYLES[category];

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-800/50 text-white">
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg">{name}</CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={`border ${categoryStyle.className}`}
            >
              {categoryStyle.label}
            </Badge>
            <Badge variant={connected ? 'glass-success' : 'secondary'}>
              {connected ? 'Connected' : 'Not connected'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription>{description}</CardDescription>

        <div className="flex gap-2">
          {connected ? (
            <>
              <Button
                onClick={onConfigure}
                disabled={loading}
                variant="outline"
                size="sm"
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Refresh
              </Button>
              <Button
                onClick={onDisconnect}
                disabled={loading}
                variant="destructive"
                size="sm"
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unlink className="w-4 h-4" />
                )}
                Disconnect
              </Button>
            </>
          ) : (
            <Button
              onClick={onConnect}
              disabled={loading}
              className="w-full gradient-primary text-white"
              size="sm"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
