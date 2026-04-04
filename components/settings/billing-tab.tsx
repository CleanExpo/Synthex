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

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  const isStarterPlan = billing.plan.toLowerCase() === 'starter';

  const PLAN_META: Record<
    string,
    { label: string; price: string; colour: string; borderColour: string }
  > = {
    starter: {
      label: 'Starter',
      price: '$99 AUD/mo',
      colour: 'text-orange-300',
      borderColour: 'border-orange-500/20',
    },
    pro: {
      label: 'Pro',
      price: '$249 AUD/mo',
      colour: 'text-orange-300',
      borderColour: 'border-orange-500/20',
    },
    growth: {
      label: 'Growth',
      price: '$449 AUD/mo',
      colour: 'text-emerald-300',
      borderColour: 'border-emerald-500/20',
    },
    scale: {
      label: 'Scale',
      price: '$799 AUD/mo',
      colour: 'text-orange-300',
      borderColour: 'border-orange-500/20',
    },
    enterprise: {
      label: 'Enterprise',
      price: 'Custom',
      colour: 'text-white/80',
      borderColour: 'border-white/[0.1]',
    },
  };

  const planMeta = PLAN_META[billing.plan.toLowerCase()];

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card variant="glass">
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            {isFreePlan
              ? 'You are on the free tier'
              : 'Manage your subscription'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isFreePlan ? (
            /* Free Plan display */
            <div className="p-5 border-[0.5px] border-white/[0.06] bg-white/[0.02] rounded-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-4 h-4 text-white/40" />
                    <h3 className="text-base font-light text-white">
                      Free Plan
                    </h3>
                    <Badge className="bg-orange-500/10 text-orange-400 border-[0.5px] border-orange-500/20 text-[10px]">
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs text-white/40">
                    Basic access to Synthex with limited features.
                  </p>
                </div>
                <Button onClick={onUpgrade} variant="glass-primary" size="sm">
                  <Zap className="w-3 h-3 mr-1.5" />
                  Upgrade
                </Button>
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-3">
                  Included on free
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    '2 social accounts',
                    '10 AI posts/mo',
                    '1 persona',
                    '3 GEO analyses',
                  ].map(f => (
                    <div
                      key={f}
                      className="flex items-center gap-1.5 text-xs text-white/50"
                    >
                      <span className="w-1 h-1 rounded-full bg-white/25 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : isStarterPlan ? (
            /* Starter Plan display */
            <div className="p-5 border-[0.5px] border-orange-500/20 bg-orange-500/[0.03] rounded-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-4 h-4 text-orange-400" />
                    <h3 className="text-base font-light text-white">
                      Starter Plan
                    </h3>
                    <Badge className="bg-orange-500/10 text-orange-400 border-[0.5px] border-orange-500/20 text-[10px]">
                      Active
                    </Badge>
                  </div>
                  <p className="text-xs text-white/40">
                    {billing.price ?? '$99 AUD'}/{billing.billingCycle ?? 'mo'}{' '}
                    • Next billing {billing.nextBilling}
                  </p>
                </div>
                <Button onClick={onUpgrade} variant="glass-primary" size="sm">
                  <Zap className="w-3 h-3 mr-1.5" />
                  Upgrade to Pro
                </Button>
              </div>
              <div className="mt-4 pt-4 border-t border-white/[0.06]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-3">
                  Starter includes
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    '3 social accounts',
                    '50 AI posts/mo',
                    'BYOK — your own AI keys',
                    '1 brand identity',
                    '15 GEO analyses/mo',
                    '5 E-E-A-T audits/mo',
                    '8 backlink analyses/mo',
                    'Email support',
                  ].map(f => (
                    <div
                      key={f}
                      className="flex items-center gap-1.5 text-xs text-white/50"
                    >
                      <span className="w-1 h-1 rounded-full bg-orange-400/50 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Paid plan display (Pro / Growth / Scale) */
            <div
              className={`flex items-center justify-between p-5 border-[0.5px] ${planMeta?.borderColour ?? 'border-white/[0.08]'} bg-white/[0.02] rounded-sm`}
            >
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles
                    className={`w-4 h-4 ${planMeta?.colour ?? 'text-orange-400'}`}
                  />
                  <h3
                    className={`text-base font-light ${planMeta?.colour ?? 'text-white'}`}
                  >
                    {planMeta?.label ?? billing.plan} Plan
                  </h3>
                </div>
                <p className="text-xs text-white/40">
                  {billing.price}/{billing.billingCycle} • Next billing{' '}
                  {billing.nextBilling}
                </p>
              </div>
              <Button onClick={onUpgrade} variant="glass-primary" size="sm">
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
            <Button variant="outline" size="sm" onClick={onManagePayment}>
              Update
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 p-4 border-[0.5px] border-white/[0.06] bg-white/[0.02] rounded-sm">
              <CreditCard className="w-6 h-6 text-orange-400/60" />
              <div>
                <p className="text-sm text-white">
                  {billing.paymentMethod} •••• {billing.cardLast4}
                </p>
                <p className="text-xs text-white/40 mt-0.5">Expires 12/2028</p>
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
            <div className="space-y-2">
              {invoices.map(invoice => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 border-[0.5px] border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] rounded-sm transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-white/50" />
                    <div>
                      <p className="text-sm text-white">{invoice.id}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {invoice.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-white/70 font-mono tabular-nums">
                      {invoice.amount}
                    </span>
                    <Badge
                      className={
                        invoice.status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border-[0.5px] border-emerald-500/20 text-[10px]'
                          : 'bg-orange-500/10 text-orange-400 border-[0.5px] border-orange-500/20 text-[10px]'
                      }
                    >
                      {invoice.status.charAt(0).toUpperCase() +
                        invoice.status.slice(1)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownloadInvoice(invoice.id)}
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
          <CardContent className="py-10">
            <div className="text-center">
              <FileText className="w-6 h-6 text-white/50 mx-auto mb-3" />
              <p className="text-xs text-white/40">
                No billing history. Upgrade to a paid plan to access invoices.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
