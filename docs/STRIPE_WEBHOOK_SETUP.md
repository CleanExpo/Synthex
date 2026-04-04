# 💳 Stripe Webhook Setup Guide for SYNTHEX

## 📋 Overview
This guide will help you set up Stripe webhooks for SYNTHEX to handle payments, subscriptions, and billing events.

## 🔑 Step 1: Get Your Stripe Keys

### Live Mode (Production)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy:
   - **Publishable key**: `pk_live_...`
   - **Secret key**: `sk_live_...`

### Test Mode (Development)
1. Toggle to **Test mode** in Stripe Dashboard
2. Copy:
   - **Publishable key**: `pk_test_...`
   - **Secret key**: `sk_test_...`

## 🔗 Step 2: Create Webhook Endpoint

### In Stripe Dashboard:
1. Go to **Developers** → **Webhooks**
2. Click **"Add endpoint"**
3. Enter endpoint URL:
   ```
   Production: https://synthex.social/api/webhooks/stripe
   Development: https://your-dev-url.vercel.app/api/webhooks/stripe
   Local: https://YOUR_NGROK_URL/api/webhooks/stripe
   ```

4. Select events to listen to:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`
   - ✅ `payment_intent.succeeded`
   - ✅ `payment_intent.payment_failed`
   - ✅ `customer.created`
   - ✅ `customer.updated`
   - ✅ `charge.succeeded`
   - ✅ `charge.failed`
   - ✅ `payment_method.attached`
   - ✅ `price.created`
   - ✅ `price.updated`
   - ✅ `product.created`
   - ✅ `product.updated`

5. Click **"Add endpoint"**
6. Copy the **Webhook signing secret**: `whsec_...`

## 🔐 Step 3: Add Environment Variables

Add these to your `.env.local` and Vercel dashboard:

```env
# Stripe API Keys
STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_PUBLISHABLE_KEY

# Webhook Secret
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

# Optional: Stripe CLI webhook secret for local testing
STRIPE_CLI_WEBHOOK_SECRET=whsec_YOUR_CLI_SECRET

# Pricing (get these from your Stripe products)
STRIPE_PRICE_FREE=price_free
STRIPE_PRICE_STARTER=price_YOUR_STARTER_PRICE_ID
STRIPE_PRICE_PRO=price_YOUR_PRO_PRICE_ID
STRIPE_PRICE_ENTERPRISE=price_YOUR_ENTERPRISE_PRICE_ID
```

## 📦 Step 4: Install Stripe SDK

```bash
npm install stripe @stripe/stripe-js
```

## 🛠️ Step 5: Webhook Endpoint Implementation

Create the webhook handler at `app/api/webhooks/stripe/route.ts`:

```typescript
import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Handler functions
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userEmail = session.customer_email!;

  // Update user subscription in database
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      current_period_start: new Date(session.created * 1000).toISOString(),
      metadata: session.metadata,
    });

  if (error) {
    console.error('Error updating subscription:', error);
  }

  // Send confirmation email
  await sendEmail(userEmail, 'subscription_confirmed', {
    customerName: session.customer_details?.name,
    plan: session.metadata?.plan,
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const plan = subscription.items.data[0]?.price.metadata.plan || 'free';
  
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      plan: 'free',
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error canceling subscription:', error);
  }
}

async function handlePaymentSuccess(invoice: Stripe.Invoice) {
  // Log successful payment
  await supabase
    .from('payment_logs')
    .insert({
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_paid / 100,
      currency: invoice.currency,
      status: 'succeeded',
      customer_email: invoice.customer_email,
    });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Log failed payment and notify user
  await supabase
    .from('payment_logs')
    .insert({
      stripe_invoice_id: invoice.id,
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
      status: 'failed',
      customer_email: invoice.customer_email,
    });

  // Send payment failed email
  if (invoice.customer_email) {
    await sendEmail(invoice.customer_email, 'payment_failed', {
      amount: invoice.amount_due / 100,
      currency: invoice.currency,
    });
  }
}

// Email helper (implement based on your email service)
async function sendEmail(to: string, template: string, data: any) {
  // Implementation depends on your email service
  console.log(`Sending ${template} email to ${to}`, data);
}
```

## 🧪 Step 6: Testing Webhooks Locally

### Using Stripe CLI:
1. Install Stripe CLI:
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe

   # Windows
   scoop install stripe

   # Or download from https://stripe.com/docs/stripe-cli
   ```

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to localhost:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. Copy the webhook signing secret displayed and add to `.env.local`:
   ```env
   STRIPE_CLI_WEBHOOK_SECRET=whsec_...
   ```

5. Trigger test events:
   ```bash
   # Test checkout completion
   stripe trigger checkout.session.completed

   # Test subscription update
   stripe trigger customer.subscription.updated

   # Test payment success
   stripe trigger invoice.payment_succeeded
   ```

### Using ngrok (Alternative):
1. Install ngrok:
   ```bash
   npm install -g ngrok
   ```

2. Expose your local server:
   ```bash
   ngrok http 3000
   ```

3. Use the ngrok URL in Stripe webhook settings

## 📊 Step 7: Create Subscription Plans in Stripe

### In Stripe Dashboard:
1. Go to **Products**
2. Create products for each tier:

#### Free Tier
- **Name:** SYNTHEX Free
- **Price:** $0/month

#### Starter Tier
- **Name:** SYNTHEX Starter
- **Price:** $29/month
- **Features:**
  - 100 AI generations/month
  - 5 social accounts
  - Basic analytics

#### Pro Tier
- **Name:** SYNTHEX Pro
- **Price:** $79/month
- **Features:**
  - 500 AI generations/month
  - Unlimited social accounts
  - Advanced analytics
  - Priority support

#### Enterprise Tier
- **Name:** SYNTHEX Enterprise
- **Price:** $299/month
- **Features:**
  - Unlimited AI generations
  - Custom integrations
  - Dedicated support
  - SLA guarantee

## 🔄 Step 8: Database Schema for Payments

Add these tables to your Supabase migration:

```sql
-- Payment logs table
CREATE TABLE IF NOT EXISTS payment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stripe_invoice_id TEXT UNIQUE,
    stripe_payment_intent_id TEXT,
    amount DECIMAL(10,2),
    currency TEXT DEFAULT 'usd',
    status TEXT,
    description TEXT,
    customer_email TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update subscriptions table
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS trial_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

-- Create indexes
CREATE INDEX idx_payment_logs_user_id ON payment_logs(user_id);
CREATE INDEX idx_payment_logs_status ON payment_logs(status);
CREATE INDEX idx_payment_logs_created_at ON payment_logs(created_at);
```

## 🎯 Step 9: Frontend Integration

### Checkout Button Component:

```typescript
// components/checkout-button.tsx
'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export default function CheckoutButton({ 
  priceId, 
  userId,
  plan 
}: { 
  priceId: string;
  userId: string;
  plan: string;
}) {
  const handleCheckout = async () => {
    const stripe = await stripePromise;
    
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        priceId,
        userId,
        plan,
      }),
    });

    const { sessionId } = await response.json();
    
    await stripe?.redirectToCheckout({ sessionId });
  };

  return (
    <Button onClick={handleCheckout}>
      Upgrade to {plan}
    </Button>
  );
}
```

## ✅ Step 10: Verification Checklist

- [ ] Stripe API keys added to environment variables
- [ ] Webhook endpoint created in Stripe Dashboard
- [ ] Webhook signing secret saved
- [ ] Webhook endpoint deployed to `/api/webhooks/stripe`
- [ ] Products and prices created in Stripe
- [ ] Database tables updated for payments
- [ ] Test webhook with Stripe CLI
- [ ] Checkout flow tested end-to-end
- [ ] Payment success/failure emails configured
- [ ] Subscription management UI created

## 🚨 Important Security Notes

1. **Never expose your secret key** - Only use it server-side
2. **Always verify webhook signatures** - Prevents fake webhook calls
3. **Use HTTPS in production** - Webhooks require secure endpoints
4. **Implement idempotency** - Handle duplicate webhook events
5. **Log all payment events** - For debugging and compliance
6. **Set up webhook retry logic** - Handle temporary failures

## 📚 Additional Resources

- [Stripe Webhook Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Stripe Testing Cards](https://stripe.com/docs/testing)
- [Stripe API Reference](https://stripe.com/docs/api)

## 🆘 Troubleshooting

### Webhook Signature Verification Failed
- Check that you're using the correct webhook secret
- Ensure you're passing the raw request body (not parsed JSON)
- Verify the endpoint URL matches exactly

### Webhook Not Receiving Events
- Check Stripe Dashboard → Webhooks for failed attempts
- Verify your endpoint is publicly accessible
- Check for any firewall or CORS issues

### Local Testing Issues
- Make sure Stripe CLI is logged in
- Verify ngrok or CLI forwarding is running
- Check that your local server is running on the correct port

---

**Need Help?** Contact Stripe Support or check the [Stripe Discord](https://discord.gg/stripe)