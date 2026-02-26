'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { loadStripe } from '@stripe/stripe-js';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface CheckoutButtonProps {
  planName: string;
  priceId?: string;
  className?: string;
  children?: React.ReactNode;
  requireAuth?: boolean;
}

export function CheckoutButton({ 
  planName, 
  priceId, 
  className,
  children = 'Start Free Trial',
  requireAuth = true
}: CheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCheckout = async () => {
    setLoading(true);

    try {
      // Check if user is authenticated
      const token = localStorage.getItem('token');
      
      if (requireAuth && !token) {
        toast.error('Please login to continue');
        router.push('/login');
        return;
      }

      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ planName, priceId }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if it's a bypass response (Stripe not configured)
        if (data.bypass) {
          toast.error(data.message || 'Payment processing not available');
          // Optionally redirect to a contact page or show a modal
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { sessionId, url } = data;

      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      } else if (sessionId) {
        // Use Stripe.js for embedded checkout
        const stripe = await stripePromise;
        if (!stripe) {
          throw new Error('Stripe failed to load');
        }

        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          throw error;
        }
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckout}
      disabled={loading}
      className={className}
      size="lg"
    >
      {loading ? 'Processing...' : children}
    </Button>
  );
}