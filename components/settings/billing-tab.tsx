'use client';

/**
 * Billing Tab Component
 * Subscription and payment management
 *
 * Handles two display modes:
 * - Free plan: shows plan info with upgrade CTA, no payment/invoice sections
 * - Paid plan: shows full billing details including payment method and invoices
 *
 * @task UNI-633 - Fix free-tier display to show "Free Plan" instead of misleading billing UI
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, FileText, Sparkles, Zap } from '@/components/icons';
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
  const isFreePlan = billing.plan.toLowerCase() === 'free';

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            {isFreePlan ? 'You are on the free tier' : 'Manage your subscription'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFreePlan ? (
            /* Free Plan display */
            <div className="p-6 rounded-lg bg-gradient-to-r from-slate-500/20 to-gray-500/20 border border-slate-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-xl font-bold text-white">Free Plan</h3>
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                      Active
                    </Badge>
                  </div>
                  <p className="text-slate-300">
                    Basic access to Synthex with limited features.
                  </p>
                </div>
                <Button onClick={onUpgrade} className="gradient-primary">
                  <Zap className="w-4 h-4 mr-2" />
                  Upgrade Plan
                </Button>
              </div>

              {/* Free plan feature summary */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-sm text-slate-400 mb-3">Your free plan includes:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Up to 2 social accounts
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    10 AI posts per month
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    1 AI persona
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Paid plan display */
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
          )}
        </CardContent>
      </Card>

      {/* Payment Method - only shown for paid plans */}
      {!isFreePlan && (
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
      )}

      {/* Invoice History - only shown when invoices exist */}
      {invoices.length > 0 && (
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
      )}

      {/* No invoices message for free plan */}
      {isFreePlan && invoices.length === 0 && (
        <Card variant="glass">
          <CardContent className="py-8">
            <div className="text-center">
              <FileText className="w-8 h-8 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">
                No billing history. Upgrade to a paid plan to access invoices and payment management.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
