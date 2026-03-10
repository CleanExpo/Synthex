'use client';

/**
 * Audit Log Detail Drawer
 *
 * Slide-out drawer that displays the full details of an audit log entry
 * when a row is clicked in the AuditLogViewer table. Renders the details
 * JSON as structured key-value pairs, along with metadata, request info,
 * and copy-to-clipboard functionality.
 *
 * @module components/admin/audit-log-drawer
 */

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy } from '@/components/icons';
import { toast } from 'sonner';

// =============================================================================
// Types
// =============================================================================

interface AuditLogEntry {
  id: string;
  createdAt: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  outcome: 'success' | 'failure';
  user?: { id: string; email: string; name?: string | null } | null;
}

interface AuditLogDrawerProps {
  entry: AuditLogEntry | null;
  open: boolean;
  onClose: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const SEVERITY_COLOURS: Record<string, string> = {
  low: 'bg-gray-500/20 text-gray-300',
  medium: 'bg-yellow-500/20 text-yellow-400',
  high: 'bg-orange-500/20 text-orange-400',
  critical: 'bg-red-500/20 text-red-400',
};

const OUTCOME_COLOURS: Record<string, string> = {
  success: 'bg-green-500/20 text-green-400',
  failure: 'bg-red-500/20 text-red-400',
};

/** Keys that receive special rendering treatment in the details section */
const REASON_KEYS = new Set(['reason', 'error', 'errorMessage', 'message']);
const HIGHLIGHT_KEYS = new Set(['targetEmail', 'email', 'attemptedEmail']);

// =============================================================================
// Helper Components
// =============================================================================

function MetadataItem({
  label,
  value,
  copyable = false,
  mono = false,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  mono?: boolean;
}) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-1">
      <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1">
        <span
          className={`text-sm text-white break-all ${mono ? 'font-mono' : ''}`}
        >
          {value}
        </span>
        {copyable && value !== 'N/A' && (
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-0.5 text-gray-500 hover:text-white transition-colors"
            title="Copy to clipboard"
          >
            <Copy className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: unknown }) {
  const isReason = REASON_KEYS.has(label);
  const isHighlight = HIGHLIGHT_KEYS.has(label);

  // Render reason / error in a callout box
  if (isReason && typeof value === 'string') {
    return (
      <div className="rounded-md bg-orange-500/10 border border-orange-500/20 p-3">
        <span className="text-xs text-orange-400 uppercase tracking-wider font-medium">
          {formatLabel(label)}
        </span>
        <p className="text-sm text-orange-200 mt-1">{value}</p>
      </div>
    );
  }

  // Render highlighted email values
  if (isHighlight && typeof value === 'string') {
    return (
      <div className="flex justify-between items-center p-2 bg-white/5 rounded">
        <span className="text-xs text-gray-400">{formatLabel(label)}</span>
        <span className="text-sm text-cyan-400 font-mono">{value}</span>
      </div>
    );
  }

  // Render objects / arrays as formatted JSON
  if (typeof value === 'object' && value !== null) {
    return (
      <div className="space-y-1">
        <span className="text-xs text-gray-400">{formatLabel(label)}</span>
        <pre className="text-xs text-gray-300 bg-white/5 rounded p-2 overflow-x-auto font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(value, null, 2)}
        </pre>
      </div>
    );
  }

  // Default: simple key-value
  return (
    <div className="flex justify-between items-center p-2 bg-white/5 rounded">
      <span className="text-xs text-gray-400">{formatLabel(label)}</span>
      <span className="text-sm text-white font-mono">{String(value ?? 'N/A')}</span>
    </div>
  );
}

/** Convert camelCase / snake_case keys to human-readable labels */
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

// =============================================================================
// Main Component
// =============================================================================

export function AuditLogDrawer({ entry, open, onClose }: AuditLogDrawerProps) {
  if (!entry) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const details = entry.details as Record<string, unknown> | null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        variant="glass-solid"
        side="right"
        className="w-[480px] sm:max-w-[480px] overflow-y-auto"
      >
        {/* -------------------------------------------------------------- */}
        {/* Header                                                         */}
        {/* -------------------------------------------------------------- */}
        <SheetHeader>
          <SheetTitle className="font-mono text-sm">{entry.action}</SheetTitle>
          <SheetDescription>
            {entry.resource}
            {entry.resourceId && (
              <span className="font-mono ml-1">#{entry.resourceId.slice(0, 8)}</span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Badges */}
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge
            className={`text-xs ${SEVERITY_COLOURS[entry.severity] ?? 'bg-gray-500/20 text-gray-300'}`}
          >
            {entry.severity}
          </Badge>
          <Badge
            className={`text-xs ${OUTCOME_COLOURS[entry.outcome] ?? 'bg-gray-500/20 text-gray-300'}`}
          >
            {entry.outcome}
          </Badge>
          <Badge className="text-xs bg-white/10 text-gray-300">{entry.category}</Badge>
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Metadata grid                                                  */}
        {/* -------------------------------------------------------------- */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          <MetadataItem
            label="Timestamp"
            value={new Date(entry.createdAt).toLocaleString('en-AU', {
              dateStyle: 'medium',
              timeStyle: 'medium',
            })}
          />
          <MetadataItem
            label="User"
            value={entry.user?.email ?? entry.userId}
            copyable
          />
          <MetadataItem label="Resource" value={entry.resource} />
          <MetadataItem
            label="Resource ID"
            value={entry.resourceId ?? 'N/A'}
            copyable
            mono
          />
        </div>

        {/* -------------------------------------------------------------- */}
        {/* Details section                                                 */}
        {/* -------------------------------------------------------------- */}
        {details && Object.keys(details).length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Details</h4>
            <div className="space-y-2">
              {Object.entries(details).map(([key, value]) => (
                <DetailRow key={key} label={key} value={value} />
              ))}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Request info                                                   */}
        {/* -------------------------------------------------------------- */}
        {(entry.ipAddress || entry.userAgent) && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Request Info</h4>
            <div className="space-y-2 text-xs">
              {entry.ipAddress && (
                <div className="flex justify-between items-center p-2 bg-white/5 rounded">
                  <span className="text-gray-400">IP Address</span>
                  <span className="text-white font-mono">{entry.ipAddress}</span>
                </div>
              )}
              {entry.userAgent && (
                <div className="p-2 bg-white/5 rounded">
                  <span className="text-gray-400">User Agent</span>
                  <p className="text-white font-mono text-xs mt-1 break-all">
                    {entry.userAgent}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------- */}
        {/* Entry ID footer                                                */}
        {/* -------------------------------------------------------------- */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Entry ID</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(entry.id)}
              className="text-gray-500 hover:text-white text-xs h-7"
            >
              {entry.id.slice(0, 12)}...
              <Copy className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
