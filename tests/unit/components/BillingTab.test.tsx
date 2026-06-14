/**
 * BillingTab Component Tests
 *
 * Guards the payment-method display against fabricated card data.
 *
 * Regression: the component previously rendered a hardcoded literal
 * "Expires 12/2028" next to every paid user's masked card — identical,
 * fabricated data shown to all paid users. These tests assert:
 *   1. No hardcoded "12/2028" date is ever rendered.
 *   2. When the billing source provides a real `cardExp`, it is shown.
 *   3. When no real expiry is available, the expiry line is omitted entirely
 *      (we show just the masked card, never invented data).
 *
 * @module tests/unit/components/BillingTab.test
 */

import { describe, it, expect, jest } from '@jest/globals';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { BillingTab } from '@/components/settings/billing-tab';
import type { BillingInfo, Invoice } from '@/components/settings/types';

const noop = jest.fn();

const basePaidBilling: BillingInfo = {
  plan: 'Pro',
  price: '$249',
  billingCycle: 'monthly',
  nextBilling: '01/01/2027',
  paymentMethod: 'Visa',
  cardLast4: '4242',
};

const invoices: Invoice[] = [];

function renderBilling(billing: BillingInfo) {
  return render(
    <BillingTab
      billing={billing}
      invoices={invoices}
      onUpgrade={noop}
      onManagePayment={noop}
      onDownloadInvoice={noop}
    />
  );
}

describe('BillingTab payment method', () => {
  it('never renders the fabricated hardcoded expiry (12/2028)', () => {
    renderBilling(basePaidBilling);
    expect(screen.queryByText(/12\/2028/)).toBeNull();
    expect(screen.queryByText(/Expires 12\/2028/)).toBeNull();
  });

  it('renders the masked card without any expiry when none is provided', () => {
    renderBilling(basePaidBilling);
    // Masked card is still shown...
    expect(screen.getByText(/Visa •••• 4242/)).toBeInTheDocument();
    // ...but no "Expires" line at all (no fabricated data).
    expect(screen.queryByText(/Expires/)).toBeNull();
  });

  it('renders the REAL expiry when the billing source provides cardExp', () => {
    renderBilling({ ...basePaidBilling, cardExp: '09/2026' });
    expect(screen.getByText(/Expires 09\/2026/)).toBeInTheDocument();
    // And it must be the real value, not the old fabricated one.
    expect(screen.queryByText(/12\/2028/)).toBeNull();
  });

  it('does not show the payment-method card for free-plan users', () => {
    renderBilling({ ...basePaidBilling, plan: 'Free' });
    expect(screen.queryByText(/•••• 4242/)).toBeNull();
    expect(screen.queryByText(/Expires/)).toBeNull();
  });
});
