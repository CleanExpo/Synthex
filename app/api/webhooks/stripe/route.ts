import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-07-30.basil',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

// Initialize Supabase client with service role for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = headers().get('stripe-signature');

  if (!signature) {
    console.error('No stripe-signature header found');
    return NextResponse.json(
      { error: 'No signature found' },
      { status: 400 }
    );
  }

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

  console.log(`Processing webhook event: ${event.type}`);

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

      case 'payment_intent.succeeded':
        console.log('Payment intent succeeded:', (event.data.object as Stripe.PaymentIntent).id);
        break;

      case 'payment_intent.payment_failed':
        console.log('Payment intent failed:', (event.data.object as Stripe.PaymentIntent).id);
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
  console.log('Processing checkout completion for session:', session.id);
  
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;
  const userEmail = session.customer_email;

  if (!userEmail) {
    console.error('No customer email found in session');
    return;
  }

  // Get user by email
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', userEmail)
    .single();

  if (userError || !userData) {
    console.error('User not found:', userEmail, userError);
    return;
  }

  // Update or create subscription record
  const { error } = await supabase
    .from('subscriptions')
    .upsert({
      user_id: userData.id,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: 'active',
      plan: session.metadata?.plan || 'starter',
      current_period_start: new Date().toISOString(),
      metadata: session.metadata,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id'
    });

  if (error) {
    console.error('Error updating subscription:', error);
  } else {
    console.log('Subscription updated successfully for user:', userData.id);
  }

  // Log the successful payment
  await logPayment({
    user_id: userData.id,
    amount: (session.amount_total || 0) / 100,
    currency: session.currency || 'usd',
    status: 'succeeded',
    customer_email: userEmail,
    stripe_payment_intent_id: session.payment_intent as string,
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  console.log('Processing subscription update:', subscription.id);
  
  const plan = subscription.items.data[0]?.price.metadata?.plan || 
               subscription.items.data[0]?.price.lookup_key || 
               'free';
  
  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan,
      status: subscription.status,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error updating subscription:', error);
  } else {
    console.log('Subscription updated successfully');
  }
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  console.log('Processing subscription cancellation:', subscription.id);
  
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      plan: 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (error) {
    console.error('Error canceling subscription:', error);
  } else {
    console.log('Subscription canceled successfully');
  }
}

async function handlePaymentSuccess(invoice: Stripe.Invoice) {
  console.log('Processing successful payment for invoice:', invoice.id);
  
  // Get user by email
  if (!invoice.customer_email) {
    console.error('No customer email in invoice');
    return;
  }

  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', invoice.customer_email)
    .single();

  await logPayment({
    user_id: userData?.id,
    stripe_invoice_id: invoice.id,
    amount: (invoice.amount_paid || 0) / 100,
    currency: invoice.currency || 'usd',
    status: 'succeeded',
    customer_email: invoice.customer_email,
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('Processing failed payment for invoice:', invoice.id);
  
  // Get user by email
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('email', invoice.customer_email!)
    .single();

  await logPayment({
    user_id: userData?.id,
    stripe_invoice_id: invoice.id,
    amount: (invoice.amount_due || 0) / 100,
    currency: invoice.currency || 'usd',
    status: 'failed',
    customer_email: invoice.customer_email!,
  });

  // Update subscription status if payment failed
  if (invoice.subscription) {
    await supabase
      .from('subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_subscription_id', invoice.subscription as string);
  }
}

// Helper function to log payments
async function logPayment(data: {
  user_id?: string;
  stripe_invoice_id?: string;
  stripe_payment_intent_id?: string;
  amount: number;
  currency: string;
  status: string;
  customer_email: string;
  description?: string;
}) {
  const { error } = await supabase
    .from('payment_logs')
    .insert({
      ...data,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error logging payment:', error);
  } else {
    console.log('Payment logged successfully');
  }
}