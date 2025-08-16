# 🎯 Production Finishing Checklist for SYNTHEX

## 1. API Keys & Config ⚙️

### 1.1 SendGrid Email Service
**Why necessary**: Without this, no user can receive verification emails, password resets, or notifications.
**Action**: 
```bash
# 1. Go to https://sendgrid.com and create account
# 2. Get API key from Settings > API Keys
# 3. Add to .env:
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx
```
**Test**: 
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
# Check SendGrid dashboard for sent email
```

### 1.2 OpenAI API Key
**Why necessary**: Content generation is core feature - without it, main value prop doesn't work.
**Action**:
```bash
# 1. Go to https://platform.openai.com/api-keys
# 2. Create new secret key
# 3. Add to .env:
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```
**Test**:
```bash
curl -X POST http://localhost:3000/api/ai/generate-content \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your-jwt-token}" \
  -d '{"prompt":"Write a LinkedIn post about AI"}'
# Should return actual generated content, not mock data
```

### 1.3 Stripe Payment Keys
**Why necessary**: Can't charge customers without payment processing.
**Action**:
```bash
# 1. Go to https://dashboard.stripe.com/test/apikeys
# 2. Copy test keys first (switch to live later)
# 3. Add to .env:
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxx
```
**Test**:
```bash
# Create checkout session
curl -X POST http://localhost:3000/api/webhooks/stripe \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_xxxxx","userId":"test-user"}'
# Should return Stripe checkout URL
```

### 1.4 Twitter/X API Credentials
**Why necessary**: Primary social platform for MVP launch.
**Action**:
```bash
# 1. Go to https://developer.twitter.com/en/portal/dashboard
# 2. Create app and get credentials
# 3. Add to .env:
TWITTER_API_KEY=xxxxxxxxxxxxxxxxxx
TWITTER_API_SECRET=xxxxxxxxxxxxxxxxxx
TWITTER_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxx
TWITTER_ACCESS_TOKEN_SECRET=xxxxxxxxxxxxxxxxxx
```
**Test**:
```bash
curl -X POST http://localhost:3000/api/social/post \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {your-jwt-token}" \
  -d '{"platform":"twitter","content":"Test post","schedule":false}'
# Check Twitter account for posted content
```

### 1.5 Upstash Redis (for rate limiting & caching)
**Why necessary**: Prevents API abuse and improves performance.
**Action**:
```bash
# 1. Go to https://console.upstash.com
# 2. Create Redis database
# 3. Add to .env:
UPSTASH_REDIS_REST_URL=https://xxxxxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxxxxxxxxxxx
```
**Test**:
```bash
node -e "
const redis = require('@upstash/redis');
const client = redis.Redis.fromEnv();
client.set('test', 'works').then(console.log);
"
# Should output 'OK'
```

## 2. UI Completion 🎨

### 2.1 Dashboard Main Page (`app/dashboard/page.tsx`)
**Why necessary**: Users land here after login - can't be empty.
**Action**:
```typescript
// Replace placeholder in app/dashboard/page.tsx with:
import { StatsCards } from '@/components/dashboard/StatsCards';
import { RecentPosts } from '@/components/dashboard/RecentPosts';
import { SchedulePreview } from '@/components/dashboard/SchedulePreview';

export default async function DashboardPage() {
  // Fetch real data from database
  const stats = await fetch('/api/dashboard/stats');
  const recentPosts = await fetch('/api/content?limit=5');
  const upcoming = await fetch('/api/scheduler/posts?status=scheduled');
  
  return (
    <div className="grid gap-6">
      <StatsCards data={stats} />
      <RecentPosts posts={recentPosts} />
      <SchedulePreview schedule={upcoming} />
    </div>
  );
}
```
**Test**: Login and verify dashboard shows real user data, not placeholders.

### 2.2 Content Editor (`app/dashboard/content/page.tsx`)
**Why necessary**: Core feature - users must create content.
**Action**:
```typescript
// Install required package
npm install @tiptap/react @tiptap/starter-kit

// Create app/dashboard/content/page.tsx:
import ContentEditor from '@/components/content/ContentEditor';
import AIAssistant from '@/components/content/AIAssistant';

export default function ContentPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ContentEditor />
      </div>
      <div>
        <AIAssistant />
      </div>
    </div>
  );
}
```
**Test**: Create a post with AI assistance and verify it saves to database.

### 2.3 Pricing Page (`app/pricing/page.tsx`)
**Why necessary**: Can't convert customers without showing prices.
**Action**:
```typescript
// Create pricing page with Stripe products
import { stripe } from '@/lib/stripe';
import PricingCard from '@/components/pricing/PricingCard';

export default async function PricingPage() {
  const prices = await stripe.prices.list({
    lookup_keys: ['starter', 'pro', 'enterprise'],
    expand: ['data.product']
  });
  
  return (
    <div className="grid md:grid-cols-3 gap-8">
      {prices.data.map(price => (
        <PricingCard key={price.id} price={price} />
      ))}
    </div>
  );
}
```
**Test**: Click "Subscribe" and verify Stripe checkout opens.

### 2.4 Analytics Dashboard (`app/dashboard/analytics/page.tsx`)
**Why necessary**: Users pay for insights - must show real metrics.
**Action**:
```bash
# Install charting library
npm install recharts

# Create analytics components in app/dashboard/analytics/page.tsx
```
**Test**: Post content and verify engagement metrics appear in charts.

## 3. API Connections 🔌

### 3.1 Fix Mock Data in `/api/ai/generate-content/route.ts`
**Why necessary**: Currently returns hardcoded responses.
**Action**:
```typescript
// Replace mock response with:
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  const { prompt, platform } = await request.json();
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo-preview",
    messages: [
      {
        role: "system",
        content: `Generate ${platform} content based on the following prompt.`
      },
      { role: "user", content: prompt }
    ],
    max_tokens: 500
  });
  
  return Response.json({ 
    content: completion.choices[0].message.content 
  });
}
```
**Test**: Generate content and verify it's unique each time.

### 3.2 Connect Social Posting in `/api/social/post/route.ts`
**Why necessary**: Currently doesn't actually post to platforms.
**Action**:
```typescript
// Install Twitter SDK
npm install twitter-api-v2

// Update route.ts:
import { TwitterApi } from 'twitter-api-v2';

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

export async function POST(request: Request) {
  const { content, platform, mediaUrls } = await request.json();
  
  if (platform === 'twitter') {
    const tweet = await twitterClient.v2.tweet(content);
    
    // Save to database
    await prisma.platformPost.create({
      data: {
        platformId: tweet.data.id,
        content,
        status: 'published',
        publishedAt: new Date()
      }
    });
    
    return Response.json({ success: true, id: tweet.data.id });
  }
}
```
**Test**: Post and verify it appears on actual Twitter account.

### 3.3 Real Analytics in `/api/analytics/dashboard/route.ts`
**Why necessary**: Currently returns static numbers.
**Action**:
```typescript
export async function GET(request: Request) {
  const userId = await getUserId(request);
  
  // Get real metrics from database
  const metrics = await prisma.$queryRaw`
    SELECT 
      COUNT(DISTINCT p.id) as total_posts,
      SUM(pm.likes) as total_likes,
      SUM(pm.shares) as total_shares,
      AVG(pm.engagement_rate) as avg_engagement
    FROM platform_posts p
    JOIN platform_metrics pm ON pm.post_id = p.id
    WHERE p.user_id = ${userId}
    AND p.published_at > NOW() - INTERVAL '30 days'
  `;
  
  return Response.json(metrics[0]);
}
```
**Test**: Check dashboard shows actual post performance.

## 4. Payments 💳

### 4.1 Create Stripe Products
**Why necessary**: Can't charge without products in Stripe.
**Action**:
```bash
# Run this script to create products:
node -e "
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createProducts() {
  // Starter Plan
  await stripe.products.create({
    name: 'Starter',
    metadata: { 
      features: JSON.stringify(['10 posts/month', '1 user', 'Basic analytics'])
    }
  });
  
  // Pro Plan  
  await stripe.products.create({
    name: 'Pro',
    metadata: {
      features: JSON.stringify(['Unlimited posts', '5 users', 'Advanced analytics'])
    }
  });
}

createProducts();
"
```
**Test**: Check Stripe dashboard for created products.

### 4.2 Implement Subscription Flow
**Why necessary**: Users can't pay without checkout.
**Action**:
```typescript
// Create app/api/create-checkout-session/route.ts:
import { stripe } from '@/lib/stripe';

export async function POST(request: Request) {
  const { priceId } = await request.json();
  const user = await getCurrentUser(request);
  
  const session = await stripe.checkout.sessions.create({
    customer_email: user.email,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    metadata: { userId: user.id }
  });
  
  return Response.json({ url: session.url });
}
```
**Test**: Complete test purchase and verify subscription activates.

### 4.3 Webhook Handler for Stripe
**Why necessary**: Must sync subscription status with database.
**Action**:
```typescript
// Update app/api/webhooks/stripe/route.ts:
export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature');
  const body = await request.text();
  
  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    process.env.STRIPE_WEBHOOK_SECRET
  );
  
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      await prisma.user.update({
        where: { id: session.metadata.userId },
        data: { 
          stripeCustomerId: session.customer,
          plan: 'pro',
          billingStatus: 'active'
        }
      });
      break;
      
    case 'customer.subscription.deleted':
      await prisma.user.update({
        where: { stripeCustomerId: event.data.object.customer },
        data: { plan: 'free', billingStatus: 'canceled' }
      });
      break;
  }
  
  return Response.json({ received: true });
}
```
**Test**: Cancel subscription in Stripe and verify user downgraded.

## 5. Deployment & Monitoring 🚀

### 5.1 Sentry Error Tracking
**Why necessary**: Can't fix bugs you don't know about.
**Action**:
```bash
# 1. Create account at https://sentry.io
# 2. Get DSN from project settings
# 3. Add to .env:
SENTRY_DSN=https://xxxxx@xxx.ingest.sentry.io/xxxxx
NEXT_PUBLIC_SENTRY_DSN=https://xxxxx@xxx.ingest.sentry.io/xxxxx

# 4. Install Sentry
npx @sentry/wizard@latest -i nextjs
```
**Test**: Throw test error and verify it appears in Sentry dashboard.

### 5.2 Health Check Endpoint
**Why necessary**: Monitoring services need to verify app is alive.
**Action**:
```typescript
// Create app/api/health/route.ts:
export async function GET() {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis
    const redis = new Redis.fromEnv();
    await redis.ping();
    
    // Check critical services
    const checks = {
      database: 'healthy',
      redis: 'healthy',
      timestamp: new Date().toISOString()
    };
    
    return Response.json(checks, { status: 200 });
  } catch (error) {
    return Response.json({ 
      error: 'Service unhealthy',
      details: error.message 
    }, { status: 503 });
  }
}
```
**Test**: `curl http://localhost:3000/api/health` returns 200 OK.

### 5.3 Rate Limiting Middleware
**Why necessary**: Prevents API abuse and ensures fair usage.
**Action**:
```typescript
// Create middleware.ts in root:
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

export async function middleware(request: Request) {
  if (request.url.includes('/api/')) {
    const ip = request.headers.get('x-forwarded-for') ?? 'anonymous';
    const { success } = await ratelimit.limit(ip);
    
    if (!success) {
      return new Response('Too Many Requests', { status: 429 });
    }
  }
}

export const config = {
  matcher: '/api/:path*',
};
```
**Test**: Make 100+ requests in 1 minute and verify 429 response.

### 5.4 Environment Variable Validation
**Why necessary**: App crashes mysteriously without required env vars.
**Action**:
```typescript
// Create lib/env.ts:
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().startsWith('sk-'),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  SENDGRID_API_KEY: z.string().startsWith('SG.'),
});

export const env = envSchema.parse(process.env);

// Import this in app/layout.tsx to validate on startup
```
**Test**: Remove an env var and verify app won't start with clear error.

### 5.5 Database Backup Cron Job
**Why necessary**: Data loss = business death.
**Action**:
```typescript
// Create app/api/cron/backup/route.ts:
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Trigger Supabase backup
  const backupUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/backup`;
  await fetch(backupUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  
  return Response.json({ backup: 'initiated' });
}
```
**Test**: Call endpoint and verify backup appears in Supabase dashboard.

## ✅ Final Verification Checklist

Run these commands to verify production readiness:

```bash
# 1. Build succeeds
npm run build

# 2. All tests pass
npm test

# 3. No TypeScript errors
npx tsc --noEmit

# 4. Database migrations current
npx prisma migrate deploy

# 5. Can register new user
curl -X POST http://localhost:3000/api/auth/register

# 6. Can generate content
curl -X POST http://localhost:3000/api/ai/generate-content

# 7. Can create subscription
curl -X POST http://localhost:3000/api/create-checkout-session

# 8. Health check passes
curl http://localhost:3000/api/health

# 9. Deploy to Vercel
vercel --prod
```

## 🚢 Ship It!

Once all items above are complete and tested:
1. Deploy to production
2. Set up monitoring alerts
3. Launch with 10 beta users
4. Iterate based on feedback

**Total time to complete all items: 3-5 days of focused work**
