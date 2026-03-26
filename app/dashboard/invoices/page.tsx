'use client';

/**
 * Invoices Dashboard Page
 *
 * Lists all invoices for the current organisation. Allows creating new invoices
 * and viewing individual invoice details.
 *
 * Auth: JWT cookie — API routes handle authentication.
 *
 * @task UNI-173 — Invoice generation, payment tracking, tax calculation
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Plus,
  RefreshCw,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  Download,
  Mail,
  Link,
} from '@/components/icons';
import { cn } from '@/lib/utils';

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: string;
  unitCents: number;
  totalCents: number;
  taxRate: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  clientAbn?: string;
  notes?: string;
  dueDate?: string;
  issuedAt?: string;
  paidAt?: string;
  stripePaymentLinkUrl?: string;
  createdAt: string;
  updatedAt: string;
  lineItems: InvoiceLineItem[];
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function formatCents(cents: number, currency = 'AUD'): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

const STATUS_CONFIG: Record<
  Invoice['status'],
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    icon: React.ElementType;
  }
> = {
  draft: { label: 'Draft', variant: 'secondary', icon: FileText },
  sent: { label: 'Sent', variant: 'default', icon: Clock },
  paid: { label: 'Paid', variant: 'default', icon: CheckCircle },
  overdue: { label: 'Overdue', variant: 'destructive', icon: AlertCircle },
  cancelled: { label: 'Cancelled', variant: 'outline', icon: AlertCircle },
};

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/invoices/list', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch invoices');
      }
      const data = await response.json();
      setInvoices(data.invoices ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load invoices';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Summary stats
  const totalOutstanding = invoices
    .filter(inv => inv.status === 'sent' || inv.status === 'overdue')
    .reduce((sum, inv) => sum + inv.totalCents, 0);
  const totalPaid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.totalCents, 0);
  const overdueCount = invoices.filter(inv => inv.status === 'overdue').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Invoices</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage client invoices, track payments and GST.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchInvoices}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button
            size="sm"
            className="gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
            onClick={() => toast.info('Invoice creation coming soon.')}
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={DollarSign}
          label="Outstanding"
          value={formatCents(totalOutstanding)}
          highlight={totalOutstanding > 0}
        />
        <StatCard
          icon={CheckCircle}
          label="Total Paid"
          value={formatCents(totalPaid)}
        />
        <StatCard
          icon={AlertCircle}
          label="Overdue"
          value={String(overdueCount)}
          highlight={overdueCount > 0}
          danger={overdueCount > 0}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <InvoicesTableSkeleton />
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-300 font-medium">{error}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={fetchInvoices}
          >
            Try again
          </Button>
        </div>
      ) : invoices.length === 0 ? (
        <EmptyState />
      ) : (
        <InvoicesTable invoices={invoices} onRefresh={fetchInvoices} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  highlight = false,
  danger = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-4 flex items-center gap-4',
        danger
          ? 'border-red-500/30 bg-red-900/10'
          : highlight
            ? 'border-cyan-500/30 bg-cyan-900/10'
            : 'border-slate-700 bg-slate-800/50'
      )}
    >
      <div
        className={cn(
          'rounded-md p-2',
          danger
            ? 'bg-red-500/20'
            : highlight
              ? 'bg-cyan-500/20'
              : 'bg-slate-700'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5',
            danger
              ? 'text-red-400'
              : highlight
                ? 'text-cyan-400'
                : 'text-slate-400'
          )}
        />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p
          className={cn(
            'text-lg font-bold',
            danger ? 'text-red-300' : highlight ? 'text-cyan-300' : 'text-white'
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function InvoicesTable({
  invoices,
  onRefresh,
}: {
  invoices: Invoice[];
  onRefresh: () => void;
}) {
  const [actionLoading, setActionLoading] = useState<Record<string, string>>(
    {}
  );

  const setLoading = (id: string, action: string) =>
    setActionLoading(prev => ({ ...prev, [id]: action }));
  const clearLoading = (id: string) =>
    setActionLoading(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

  const handleMarkPaid = async (id: string) => {
    setLoading(id, 'paid');
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      if (!res.ok) throw new Error('Failed to update invoice');
      toast.success('Invoice marked as paid');
      onRefresh();
    } catch {
      toast.error('Failed to mark invoice as paid');
    } finally {
      clearLoading(id);
    }
  };

  const handleDownloadPdf = (invoice: Invoice) => {
    window.open(`/api/invoices/${invoice.id}/pdf`, '_blank');
  };

  const handleSend = async (id: string) => {
    setLoading(id, 'send');
    try {
      const res = await fetch(`/api/invoices/${id}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? 'Failed to send invoice'
        );
      }
      toast.success('Invoice sent to client');
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to send invoice'
      );
    } finally {
      clearLoading(id);
    }
  };

  const handlePaymentLink = async (invoice: Invoice) => {
    // Already have a link — copy it
    if (invoice.stripePaymentLinkUrl) {
      await navigator.clipboard.writeText(invoice.stripePaymentLinkUrl);
      toast.success('Payment link copied to clipboard');
      return;
    }
    setLoading(invoice.id, 'link');
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/payment-link`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? 'Failed to create payment link'
        );
      }
      const data: { paymentLinkUrl: string } = await res.json();
      await navigator.clipboard.writeText(data.paymentLinkUrl);
      toast.success('Payment link created and copied to clipboard');
      onRefresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create payment link'
      );
    } finally {
      clearLoading(invoice.id);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-800 border-b border-slate-700">
          <tr>
            {[
              'Invoice',
              'Client',
              'Amount',
              'Due Date',
              'Status',
              'Actions',
            ].map(col => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {invoices.map(invoice => {
            const cfg = STATUS_CONFIG[invoice.status];
            const StatusIcon = cfg.icon;
            const loading = actionLoading[invoice.id];
            const isPaid = invoice.status === 'paid';
            const isCancelled = invoice.status === 'cancelled';
            return (
              <tr
                key={invoice.id}
                className="bg-slate-900 hover:bg-slate-800/60 transition-colors"
              >
                <td className="px-4 py-3 font-mono font-medium text-white">
                  {invoice.invoiceNumber}
                </td>
                <td className="px-4 py-3">
                  <div className="text-white">{invoice.clientName}</div>
                  <div className="text-slate-400 text-xs">
                    {invoice.clientEmail}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-white">
                  {formatCents(invoice.totalCents, invoice.currency)}
                  {invoice.taxCents > 0 && (
                    <div className="text-xs text-slate-400">
                      incl. {formatCents(invoice.taxCents, invoice.currency)}{' '}
                      GST
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {formatDate(invoice.dueDate)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={cfg.variant} className="gap-1 text-xs">
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 flex-wrap">
                    {/* PDF download — always available */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      title="Download PDF"
                      onClick={() => handleDownloadPdf(invoice)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>

                    {/* Send — draft/sent/overdue */}
                    {!isPaid && !isCancelled && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-slate-400 hover:text-cyan-400"
                        title="Email to client"
                        disabled={loading === 'send'}
                        onClick={() => handleSend(invoice.id)}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Payment link — draft/sent/overdue */}
                    {!isPaid && !isCancelled && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                          'h-7 w-7 p-0',
                          invoice.stripePaymentLinkUrl
                            ? 'text-green-400 hover:text-green-300'
                            : 'text-slate-400 hover:text-cyan-400'
                        )}
                        title={
                          invoice.stripePaymentLinkUrl
                            ? 'Copy payment link'
                            : 'Create payment link'
                        }
                        disabled={loading === 'link'}
                        onClick={() => handlePaymentLink(invoice)}
                      >
                        <Link className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Mark paid — sent/overdue */}
                    {(invoice.status === 'sent' ||
                      invoice.status === 'overdue') && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 px-2"
                        disabled={loading === 'paid'}
                        onClick={() => handleMarkPaid(invoice.id)}
                      >
                        Mark Paid
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/30 p-12 text-center">
      <FileText className="h-12 w-12 text-slate-500 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">No invoices yet</h3>
      <p className="text-slate-400 text-sm max-w-sm mx-auto">
        Create your first invoice to start tracking client payments and GST.
      </p>
      <Button
        className="mt-6 gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold"
        onClick={() => toast.info('Invoice creation coming soon.')}
      >
        <Plus className="h-4 w-4" />
        Create Invoice
      </Button>
    </div>
  );
}

function InvoicesTableSkeleton() {
  return (
    <div className="rounded-lg border border-slate-700 overflow-hidden animate-pulse">
      <div className="bg-slate-800 h-10" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-slate-900 border-t border-slate-700/50 h-14"
        />
      ))}
    </div>
  );
}
