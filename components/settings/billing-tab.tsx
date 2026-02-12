'use client';

/**
 * Billing Tab Component
 * Subscription and payment management
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, FileText, Sparkles } from '@/components/icons';
import type { BillingInfo, Invoice } from './types';

interface BillingTabProps {
  billing: BillingInfo;
  invoices: Invoice[];
  onUpgrade: () => void;
  onManagePayment: () => void;
  onDownloadInvoice: (invoiceId: string) => void;
}

export function BillingTab({
  billing,
  invoices,
  onUpgrade,
  onManagePayment,
  onDownloadInvoice,
}: BillingTabProps) {
  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Manage your subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-6 rounded-lg bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="text-xl font-bold text-white">{billing.plan} Plan</h3>
              </div>
              <p className="text-slate-300">
                {billing.price}/{billing.billingCycle} • Next billing on {billing.nextBilling}
              </p>
            </div>
            <Button onClick={onUpgrade} className="gradient-primary">
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card variant="glass">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>Manage your payment details</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onManagePayment}
            className="bg-white/5 border-white/10"
          >
            Update
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10">
            <CreditCard className="w-8 h-8 text-cyan-500" />
            <div>
              <p className="font-medium text-white">{billing.paymentMethod} •••• {billing.cardLast4}</p>
              <p className="text-sm text-slate-400">Expires 12/2028</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>Download past invoices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="font-medium text-white">{invoice.id}</p>
                    <p className="text-sm text-slate-400">{invoice.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-medium text-white">{invoice.amount}</span>
                  <Badge
                    className={
                      invoice.status === 'paid'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    }
                  >
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDownloadInvoice(invoice.id)}
                    className="text-slate-400 hover:text-white"
                  >
                    Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
