# Platform Integrations - User Guide

## How Synthex Integrations Work

**IMPORTANT:** Synthex is a SaaS platform where **each user connects their own social media accounts** using their own API credentials. You (as the platform owner) do NOT provide OAuth apps or API keys for users.

## For Platform Owners (You)

### What You Need to Set Up:
1. **Database** (Supabase) - To store encrypted user credentials
2. **Authentication** - So users can sign up and log in
3. **Encryption Key** - To securely encrypt user API keys
4. **AI Service** (OpenRouter) - For content generation

### What You DON'T Need:
- ❌ Twitter OAuth App
- ❌ Facebook App ID
- ❌ LinkedIn Client ID
- ❌ Any social media developer accounts

## For Your Users (Your Clients)

### How Users Connect Their Accounts:

1. **User signs up** for Synthex
2. **User navigates** to Dashboard → Integrations
3. **User clicks** "Connect" on any platform
4. **Modal opens** with two tabs:
   - **API Credentials**: Where they enter their keys
   - **How to Get Keys**: Step-by-step instructions

### What Each User Needs:

#### Twitter/X
- API Key
- API Secret
- Access Token
- Access Token Secret
- (From their own Twitter Developer account)

#### LinkedIn
- Client ID
- Client Secret
- Access Token
- (From their own LinkedIn Developer account)

#### Instagram
- Access Token
- Business Account ID
- (From Facebook Developer Console)

#### Facebook
- Page Access Token
- Page ID
- (From Facebook Developer Console)

#### TikTok
- Access Token
- Open ID
- (From TikTok Developer Portal)

## Security Architecture

```
User's API Keys
    ↓
Entered in UI
    ↓
Encrypted with ENCRYPTION_KEY
    ↓
Stored in Database (per user)
    ↓
Decrypted when needed
    ↓
Used to post to user's accounts
```

## File Structure

```
app/dashboard/integrations/page.tsx
- Shows all available platforms
- "Connect" buttons for each
- Displays connection status

components/IntegrationModal.tsx
- Tab 1: Input fields for API credentials
- Tab 2: Instructions to get credentials
- Validates and saves credentials

app/api/integrations/[platform]/connect/route.ts
- Receives credentials from frontend
- Encrypts credentials
- Stores in database per user
- Returns success/failure
```

## Database Schema

Each user's integrations are stored like:

```sql
user_integrations {
  id: uuid
  user_id: uuid (references users table)
  platform: string (twitter, linkedin, etc)
  credentials: jsonb (encrypted)
  connected_at: timestamp
  last_used: timestamp
  status: string (active, expired, error)
}
```

## Testing the System

### As Platform Owner:
1. Set up Supabase database
2. Add ENCRYPTION_KEY to environment
3. Deploy to Vercel

### As a Test User:
1. Sign up for an account
2. Go to /dashboard/integrations
3. Click "Connect" on Twitter
4. Enter test API credentials
5. Verify connection saves successfully

## Common Issues & Solutions

### Issue: "Connect" button does nothing
**Solution:** Check console for errors. Ensure API routes are deployed.

### Issue: Credentials not saving
**Solution:** Verify ENCRYPTION_KEY is set in environment variables.

### Issue: Can't post to social media
**Solution:** User's API keys may be invalid or expired. They need to regenerate them.

## Platform Owner Checklist

✅ Set up Supabase project  
✅ Add SUPABASE_URL and SUPABASE_ANON_KEY to Vercel  
✅ Generate and add ENCRYPTION_KEY  
✅ Add OPENROUTER_API_KEY for AI features  
✅ Deploy application  
✅ Test with a demo user account  

## User Onboarding Flow

1. **Sign Up** → Create account
2. **Tutorial** → Show how to get API keys
3. **Connect** → Enter their credentials
4. **Test Post** → Verify connection works
5. **Start Using** → Create AI content

## Support Resources

### For Your Users:
- In-app instructions for each platform
- Direct links to developer portals
- Video tutorials (create these)
- FAQ section

### Error Messages to Handle:
- "Invalid API credentials"
- "Rate limit exceeded"
- "Token expired"
- "Insufficient permissions"

## Important Notes

1. **Users own their data**: Each user's posts go directly to their accounts
2. **No middleman**: Synthex doesn't post through your accounts
3. **Compliance**: Users are responsible for their content
4. **Rate limits**: Each user has their own rate limits
5. **Security**: Credentials are encrypted and isolated per user