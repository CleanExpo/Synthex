'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Link2, Loader2 } from '@/components/icons';

export interface ReconnectNoticeProps {
  /** Human-readable reason the connection needs reconnecting (no secrets). */
  reason?: string;
  /** True while the reconnect OAuth flow is in progress. */
  loading?: boolean;
  /** Invoked when the user clicks Reconnect — should route to the connect flow. */
  onReconnect: () => void;
}

/**
 * Presentational "Reconnect needed" badge — used in place of the plain
 * "Connected" badge when the API reports `needsReconnect` for a connection
 * whose stored token could not be decrypted (encryption-key mismatch).
 *
 * Uses the design-token Badge `status-error` variant (no raw hex / sub-11px).
 */
export function ReconnectBadge() {
  return <Badge variant="status-error">Reconnect needed</Badge>;
}

/**
 * Presentational reconnect call-to-action — an explanatory note plus a
 * Reconnect button. Rendered instead of the Refresh/Disconnect controls when a
 * connection is stranded by a key mismatch.
 */
export function ReconnectNotice({
  reason,
  loading,
  onReconnect,
}: ReconnectNoticeProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-300" />
          <div>
            <p className="font-medium">Reconnect needed</p>
            <p className="mt-1 text-xs leading-5 text-red-100/80">
              {reason ||
                'Stored credentials could not be verified. Please reconnect this account.'}
            </p>
          </div>
        </div>
      </div>
      <Button
        onClick={onReconnect}
        disabled={loading}
        className="w-full gradient-primary text-white"
        size="sm"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Reconnecting...
          </>
        ) : (
          <>
            <Link2 className="mr-2 h-4 w-4" />
            Reconnect
          </>
        )}
      </Button>
    </div>
  );
}
