# SYNTHEX API Integration Guides

This guide will help you connect your social media accounts to SYNTHEX. Each platform requires API credentials that you obtain directly from the platform's developer portal.

## 🔐 Security First

- **Your credentials are yours**: You use your own API keys, not ours
- **End-to-end encryption**: All credentials are encrypted before storage
- **Direct posting**: Content goes directly from SYNTHEX to your accounts
- **Revokable access**: Disconnect anytime from the integrations page

---

## 🐦 Twitter / X Integration

### Prerequisites
- Twitter/X account
- Phone number verified on account
- Developer account (free tier available)

### Step-by-Step Guide

#### 1. Create Developer Account
1. Visit [developer.twitter.com](https://developer.twitter.com)
2. Click "Sign up" for developer account
3. Select "Hobbyist" → "Making a bot"
4. Complete the application (be honest about usage)
5. Verify email address

#### 2. Create a Project and App
1. Go to [Developer Portal Dashboard](https://developer.twitter.com/en/portal/dashboard)
2. Click "Create Project"
   - Name: "SYNTHEX Integration"
   - Use case: "Making a bot"
3. Create an App within the project
   - App name: "SYNTHEX-[YourName]"
   - Note: App names must be unique

#### 3. Configure App Permissions
1. Go to your app's settings
2. Click "User authentication settings"
3. Enable OAuth 1.0a
4. Set permissions:
   - ✅ Read
   - ✅ Write
   - ✅ Direct Messages (optional)
5. Add callback URL: `https://synthex.social/api/callback/twitter`

#### 4. Generate API Keys
1. Go to "Keys and tokens" tab
2. Generate/Regenerate:
   - **API Key** (Consumer Key)
   - **API Secret** (Consumer Secret)
   - **Access Token**
   - **Access Token Secret**
3. Copy all 4 values immediately (won't be shown again)

#### 5. Connect to SYNTHEX
1. Go to SYNTHEX Integrations page
2. Click "Connect" on Twitter card
3. Paste your 4 credentials
4. Click "Connect Account"

### Troubleshooting
- **Rate limits**: Free tier allows 1,500 posts/month
- **Elevated access**: For advanced features, apply for elevated access
- **Suspended apps**: Check developer portal for any policy violations

---

## 💼 LinkedIn Integration

### Prerequisites
- LinkedIn account
- Company page (for business posting)
- LinkedIn app (free)

### Step-by-Step Guide

#### 1. Create LinkedIn App
1. Visit [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Click "Create app"
3. Fill in details:
   - App name: "SYNTHEX Integration"
   - LinkedIn Page: Select your company page
   - Privacy policy URL: `https://synthex.social/privacy`
   - App logo: Upload any logo
4. Check "I have read and agree"
5. Click "Create app"

#### 2. Request Access
1. Go to "Products" tab
2. Request access to:
   - ✅ Share on LinkedIn
   - ✅ Sign In with LinkedIn
3. Wait for approval (usually instant for basic access)

#### 3. Configure OAuth
1. Go to "Auth" tab
2. Add redirect URL: `https://synthex.social/api/callback/linkedin`
3. Copy credentials:
   - **Client ID**
   - **Client Secret**

#### 4. Generate Access Token
1. Go to "Tools" → "Token generator"
2. Select scopes:
   - `r_liteprofile`
   - `w_member_social`
3. Generate token
4. Copy the **Access Token**

#### 5. Connect to SYNTHEX
1. Go to SYNTHEX Integrations page
2. Click "Connect" on LinkedIn card
3. Enter your credentials:
   - Client ID
   - Client Secret
   - Access Token
4. Click "Connect Account"

### Troubleshooting
- **Company page required**: Personal profiles need company association
- **Token expiry**: Tokens expire after 60 days, re-authenticate periodically
- **Posting limits**: 100 shares per day, 1000 per month

---

## 📸 Instagram Integration

### Prerequisites
- Instagram Professional account (Business or Creator)
- Facebook Page linked to Instagram
- Facebook Developer account

### Step-by-Step Guide

#### 1. Convert to Professional Account
1. Open Instagram → Settings → Account
2. Switch to Professional Account
3. Choose Business or Creator
4. Connect to Facebook Page

#### 2. Create Facebook App
1. Visit [developers.facebook.com](https://developers.facebook.com)
2. Click "Create App"
3. Select "Business" type
4. Fill in details:
   - App name: "SYNTHEX Integration"
   - Contact email: Your email
   - App purpose: "Yourself or your own business"

#### 3. Add Instagram Basic Display
1. In app dashboard, click "Add Product"
2. Find "Instagram Basic Display" → Set Up
3. Create new Instagram App ID
4. Add redirect URI: `https://synthex.social/api/callback/instagram`

#### 4. Configure Permissions
1. Go to Instagram Basic Display → Basic Display
2. Add Instagram testers (your account)
3. Submit for App Review with:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_show_list`

#### 5. Generate Tokens
1. Go to Tools → Access Token Generator
2. Select your Instagram account
3. Generate token
4. Copy the **Access Token**

#### 6. Connect to SYNTHEX
1. Go to SYNTHEX Integrations page
2. Click "Connect" on Instagram card
3. Enter:
   - App ID
   - App Secret
   - Access Token
4. Click "Connect Account"

### Troubleshooting
- **Business account required**: Personal accounts can't use API
- **Facebook Page link**: Must link Instagram to Facebook Page
- **Content requirements**: Images must be 1080x1080 minimum
- **Video limitations**: Reels API requires additional approval

---

## 📘 Facebook Integration

### Prerequisites
- Facebook account
- Facebook Page (required for posting)
- Facebook Developer account

### Step-by-Step Guide

#### 1. Create Facebook App
1. Visit [developers.facebook.com](https://developers.facebook.com)
2. Click "Create App"
3. Choose "Business" type
4. Enter details:
   - App name: "SYNTHEX Integration"
   - Contact email: Your email

#### 2. Configure Facebook Login
1. Add Product → Facebook Login
2. Settings → Valid OAuth Redirect URIs:
   - Add: `https://synthex.social/api/callback/facebook`
3. Save changes

#### 3. Set Permissions
1. Go to App Review → Permissions and Features
2. Request:
   - `pages_show_list`
   - `pages_manage_posts`
   - `pages_read_engagement`
3. Complete data use checkup

#### 4. Generate Page Access Token
1. Go to Tools → Graph API Explorer
2. Select your app
3. Select your Facebook Page
4. Generate Access Token
5. Click "Extend Access Token" for 60-day token

#### 5. Connect to SYNTHEX
1. Go to SYNTHEX Integrations page
2. Click "Connect" on Facebook card
3. Enter:
   - App ID
   - App Secret
   - Page Access Token
   - Page ID
4. Click "Connect Account"

### Troubleshooting
- **Page required**: Can't post to personal profiles via API
- **Token renewal**: Tokens expire, set reminder to refresh
- **Review process**: Some features need Facebook approval

---

## 🎵 TikTok Integration

### Prerequisites
- TikTok account
- TikTok for Developers account
- Business account recommended

### Step-by-Step Guide

#### 1. Register as Developer
1. Visit [developers.tiktok.com](https://developers.tiktok.com)
2. Sign in with TikTok account
3. Register as developer
4. Verify email

#### 2. Create App
1. Go to Manage apps → Create
2. Fill in details:
   - App name: "SYNTHEX Integration"
   - Description: "Social media management"
3. Await approval (24-48 hours)

#### 3. Configure App
1. Once approved, go to app settings
2. Add redirect URI: `https://synthex.social/api/callback/tiktok`
3. Select scopes:
   - `user.info.basic`
   - `video.list`
   - `video.upload`

#### 4. Get Credentials
1. Go to app dashboard
2. Copy:
   - **Client Key**
   - **Client Secret**

#### 5. Generate Access Token
(TikTok uses OAuth flow, handled by SYNTHEX)

#### 6. Connect to SYNTHEX
1. Go to SYNTHEX Integrations page
2. Click "Connect" on TikTok card
3. Enter Client Key and Client Secret
4. You'll be redirected to TikTok to authorize
5. Approve permissions

### Troubleshooting
- **Approval delays**: TikTok app review takes 1-2 days
- **Video requirements**: Specific format and size requirements
- **Geographic restrictions**: Some features region-locked

---

## 🔧 General Troubleshooting

### Common Issues

#### "Invalid API credentials"
- Double-check copied values (no extra spaces)
- Ensure app is approved/active
- Regenerate tokens if needed

#### "Rate limit exceeded"
- Check platform's rate limits
- Upgrade to higher tier if available
- Distribute posts throughout the day

#### "Permission denied"
- Verify all required permissions granted
- Re-authenticate if permissions changed
- Check if app is in development/live mode

#### "Token expired"
- Most tokens expire (30-60 days)
- Set calendar reminders to refresh
- Use SYNTHEX notification settings

### Best Practices

1. **Security**
   - Never share API keys
   - Regenerate if compromised
   - Use separate apps for testing

2. **Rate Limits**
   - Know your limits per platform
   - Schedule posts to avoid bursts
   - Monitor usage in platform dashboards

3. **Maintenance**
   - Check monthly for token expiry
   - Review platform policy updates
   - Keep apps in production mode

---

## 📞 Need Help?

### SYNTHEX Support
- Email: support@synthex.social
- Documentation: https://synthex.social/docs
- Status: https://status.synthex.social

### Platform Support
- Twitter: https://developer.twitter.com/en/support
- LinkedIn: https://www.linkedin.com/help/linkedin
- Instagram: https://help.instagram.com
- Facebook: https://developers.facebook.com/support
- TikTok: https://developers.tiktok.com/support

### Community
- Discord: https://discord.gg/synthex
- GitHub: https://github.com/synthex/support

---

*Last Updated: 2025-01-14*
*Version: 1.0.0*