# Stripe Setup Guide for SYNTHEX

## 🎯 Quick Setup (Test Mode)

### Step 1: Create Stripe Account
1. Go to https://stripe.com and sign up
2. Once logged in, ensure you're in **Test Mode** (toggle in dashboard header)

### Step 2: Create Products & Prices

Navigate to **Products** in Stripe Dashboard and create three products:

#### Product 1: Professional Plan
```
Name: SYNTHEX Professional
Description: Perfect for professionals and content creators
Price: $49.00 USD / month
Price ID: Will be auto-generated (e.g., price_1OaBC...)
```

#### Product 2: Business Plan
```
Name: SYNTHEX Business
Description: For businesses and marketing teams
Price: $99.00 USD / month
Price ID: Will be auto-generated (e.g., price_1ObCD...)
```

#### Product 3: Custom Plan (Optional)
```
Name: SYNTHEX Custom
Description: Enterprise solutions tailored to your needs
Price: Custom (contact sales)
```

### Step 3: Add Price IDs to Vercel

After creating products, copy the Price IDs and add to Vercel:

```bash
# Professional Plan Price ID
vercel env add STRIPE_PROFESSIONAL_PRICE_ID production
# Paste: price_1OaBC... (your actual price ID)

# Business Plan Price ID
vercel env add STRIPE_BUSINESS_PRICE_ID production
# Paste: price_1ObCD... (your actual price ID)

# Custom Plan Price ID (optional)
vercel env add STRIPE_CUSTOM_PRICE_ID production
# Paste: price_1OcDE... (your actual price ID)
```

### Step 4: Configure Webhook Endpoint

1. In Stripe Dashboard, go to **Developers → Webhooks**
2. Click **Add endpoint**
3. Enter endpoint URL:
   ```
   https://your-domain.vercel.app/api/webhooks/stripe
   ```
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. After creating, copy the **Signing secret** (starts with `whsec_`)
6. Update in Vercel (if not already set):
   ```bash
   vercel env add STRIPE_WEBHOOK_SECRET production
   # Paste: whsec_... (your webhook signing secret)
   ```

### Step 5: Configure Customer Portal

1. Go to **Settings → Billing → Customer portal**
2. Enable the customer portal
3. Configure settings:
   - ✅ Allow customers to update payment methods
   - ✅ Allow customers to update subscriptions
   - ✅ Allow customers to cancel subscriptions
   - ✅ Allow customers to view invoices

### Step 6: Test the Integration

#### Test Card Numbers:
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002
- **Requires auth:** 4000 0025 0000 3155

#### Test Flow:
1. Go to https://your-domain.vercel.app/pricing
2. Click "Start Free Trial" on any plan
3. Enter test card: 4242 4242 4242 4242
4. Use any future expiry date (e.g., 12/34)
5. Use any 3-digit CVC (e.g., 123)
6. Complete checkout
7. Check Stripe Dashboard for the test payment

## 📊 Production Checklist

Before going live:

- [ ] Switch Stripe to **Live Mode**
- [ ] Create live products with real prices
- [ ] Update all Price IDs in Vercel with live IDs
- [ ] Update API keys (use live keys, not test keys)
- [ ] Update webhook endpoint with live signing secret
- [ ] Test with a real card (small amount)
- [ ] Set up tax settings if required
- [ ] Configure receipt emails
- [ ] Set up fraud prevention rules

## 🔑 Environment Variables Summary

```env
# Already configured in Vercel:
STRIPE_SECRET_KEY=sk_test_...        # ✅ Configured
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...  # ✅ Configured
STRIPE_WEBHOOK_SECRET=whsec_...      # ✅ Configured

# Need to add after creating products:
STRIPE_PROFESSIONAL_PRICE_ID=price_...  # ⚠️ Add after creating
STRIPE_BUSINESS_PRICE_ID=price_...      # ⚠️ Add after creating
STRIPE_CUSTOM_PRICE_ID=price_...        # ⚠️ Add after creating (optional)
```

## 💳 Subscription Management

### Customer Actions:
- **Upgrade/Downgrade:** Via billing portal
- **Cancel:** Via billing portal
- **Update payment:** Via billing portal
- **View invoices:** Via billing portal

### Admin Actions:
- **View subscriptions:** Stripe Dashboard → Customers
- **Issue refunds:** Stripe Dashboard → Payments
- **Adjust pricing:** Update products, then migrate customers
- **View analytics:** Stripe Dashboard → Analytics

## 🚨 Common Issues & Solutions

### Issue: Checkout doesn't redirect
**Solution:** Ensure `NEXT_PUBLIC_APP_URL` is set correctly in Vercel

### Issue: Webhook events not received
**Solution:** Check webhook signing secret matches exactly

### Issue: "No such price" error
**Solution:** Verify price IDs are correct and match your Stripe mode (test/live)

### Issue: Customer can't access billing portal
**Solution:** Enable customer portal in Stripe settings

## 📞 Testing Scenarios

### Scenario 1: New Subscription
1. User signs up → Selects plan → Completes checkout
2. Verify: Subscription created in Stripe
3. Verify: User can access premium features

### Scenario 2: Upgrade Plan
1. User on Professional → Upgrades to Business
2. Verify: Prorated charge in Stripe
3. Verify: New limits applied immediately

### Scenario 3: Cancel Subscription
1. User cancels via billing portal
2. Verify: Access continues until period end
3. Verify: No renewal charge

### Scenario 4: Failed Payment
1. Use declining test card
2. Verify: Subscription marked as past_due
3. Verify: User notified to update payment

## 🎯 Quick Test URLs

After setup, test these URLs:
- **Pricing Page:** /pricing
- **Checkout:** Click any plan button
- **Billing Portal:** /dashboard/billing → "Open Billing Portal"
- **Webhook Test:** Stripe Dashboard → Webhooks → Send test event

## 📈 Revenue Tracking

Monitor your revenue in Stripe Dashboard:
- **MRR:** Monthly Recurring Revenue
- **Churn:** Cancellation rate
- **LTV:** Customer Lifetime Value
- **Conversion:** Trial to paid conversion rate

---

**Note:** Start in Test Mode and only switch to Live Mode when you're ready to accept real payments. All test data is separate from live data.