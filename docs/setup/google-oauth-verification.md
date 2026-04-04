# Google OAuth Consent Screen Verification Guide

Guide for verifying your Google OAuth consent screen for production deployment with 100+ users.

## Why Verification is Required

### Unverified App Limitations

Without verification:
- Limited to **100 test users** maximum
- Users see a scary "Google hasn't verified this app" warning
- Users must click through multiple warning screens
- 7-day token expiration for sensitive scopes
- Cannot publish on Google Workspace Marketplace

### When Verification is Mandatory

Verification is required when:
1. Your app will have more than 100 users
2. You use sensitive or restricted scopes
3. You want to remove the "unverified app" warning
4. You're distributing via Google Workspace Marketplace

---

## Scopes Used by Synthex

### Non-Sensitive Scopes (No Verification Required)

| Scope | Purpose |
|-------|---------|
| `openid` | OpenID Connect authentication |
| `.../auth/userinfo.email` | Read user's email address |
| `.../auth/userinfo.profile` | Read user's basic profile info |

### Sensitive Scopes (Verification Required)

| Scope | Purpose | Justification |
|-------|---------|---------------|
| `youtube.readonly` | Read user's YouTube data | Required to sync channel analytics and video performance metrics for the marketing dashboard |

### Restricted Scopes (Verification + Security Assessment)

| Scope | Purpose | Justification |
|-------|---------|---------------|
| `youtube.upload` | Upload videos to user's channel | Core feature - users schedule and publish video content directly from Synthex |
| `youtube.force-ssl` | Manage YouTube account | Required for video publishing workflow with proper SSL enforcement |

> **Note**: Restricted scopes require a security assessment in addition to standard verification.

---

## Verification Requirements

### 1. Published Privacy Policy

Your privacy policy must:
- Be publicly accessible (not behind login)
- Clearly describe what data you collect
- Explain how data is used, stored, and protected
- Include data retention and deletion policies
- Specify third-party data sharing

**Required URL**: `https://synthex.vercel.app/privacy`

**Key sections to include**:
```markdown
## Data We Collect
- Google account information (email, name, profile picture)
- YouTube channel data (videos, analytics, subscribers)
- Content you create in Synthex

## How We Use Data
- Display your YouTube analytics in your dashboard
- Schedule and publish videos on your behalf
- Generate AI-powered content suggestions

## Data Storage
- Stored securely in encrypted databases
- Access tokens encrypted at rest
- Regular security audits

## Data Deletion
- Delete your account at any time
- All data removed within 30 days
- Request data export before deletion
```

### 2. Published Terms of Service

Your terms of service must:
- Define acceptable use
- Limit liability
- Describe service modifications

**Required URL**: `https://synthex.vercel.app/terms`

### 3. Domain Verification

You must prove ownership of your domain:

1. Go to [Google Search Console](https://search.google.com/search-console/)
2. Add your domain as a property
3. Verify using DNS TXT record (recommended):

   ```
   Record Type: TXT
   Host: @ or synthex (depending on provider)
   Value: google-site-verification=XXXXXXXXXXXXXX
   ```

4. Wait for verification to complete (up to 72 hours)

### 4. Application Homepage

Your homepage must:
- Clearly describe what your application does
- Be accessible without authentication
- Match the branding in your OAuth consent screen

**Required URL**: `https://synthex.vercel.app`

---

## Scope Justifications

When submitting for verification, you'll need to justify each scope. Use these templates:

### youtube.readonly

> **Justification**: Synthex is a social media management platform that helps content creators track their YouTube channel performance. We use the youtube.readonly scope to:
>
> 1. Sync channel subscriber counts and view statistics
> 2. Display video performance metrics (views, likes, comments)
> 3. Show analytics trends over time in the user's dashboard
> 4. Compare performance across multiple social platforms
>
> This data is displayed only to the authenticated user and is never shared with third parties.

### youtube.upload

> **Justification**: Synthex enables content creators to schedule and publish YouTube videos from a unified dashboard. We use the youtube.upload scope to:
>
> 1. Upload videos that users have scheduled in their content calendar
> 2. Set video metadata (title, description, tags) defined by the user
> 3. Configure privacy settings (public, private, unlisted) per user preference
>
> Video uploads are initiated only by explicit user action through our scheduling interface. Users have full control over what content is published and when.

### youtube.force-ssl

> **Justification**: The youtube.force-ssl scope is required for secure video management operations. We use it to:
>
> 1. Ensure all API communications use SSL encryption
> 2. Manage video publishing with enforced security
> 3. Protect user credentials and content during transmission
>
> This scope is essential for maintaining security compliance and protecting user data.

---

## Verification Process

### Step 1: Prepare Documentation

Before submitting:

- [ ] Privacy policy published and accessible
- [ ] Terms of service published and accessible
- [ ] Domain verified in Search Console
- [ ] Application homepage live
- [ ] All redirect URIs using HTTPS (production)
- [ ] Scopes list finalized

### Step 2: Submit for Verification

1. Go to **Google Cloud Console > APIs & Services > OAuth consent screen**
2. Click **Edit App** if needed
3. Review all sections are complete
4. Click **Submit for verification**
5. Complete the verification form

### Step 3: Provide Demo Video

Google typically requests a video demonstrating:

1. How users authorize the app
2. What data is accessed and how it's displayed
3. How the sensitive scopes are used in the app

**Video requirements**:
- 3-5 minutes length
- Show the complete OAuth flow
- Demonstrate each scope's usage
- Upload as unlisted YouTube video or Google Drive

### Step 4: Security Assessment (Restricted Scopes)

For restricted scopes (`youtube.upload`, `youtube.force-ssl`):

1. Google assigns a third-party security assessor
2. You'll receive a questionnaire about:
   - Data handling practices
   - Security measures
   - Penetration testing results
   - Incident response procedures
3. May require a code review or penetration test

**Cost**: ~$15,000-$75,000 depending on scope

### Step 5: Review Timeline

| Stage | Timeline |
|-------|----------|
| Initial submission | 1-2 days for acknowledgment |
| Basic review | 2-4 weeks |
| Additional information requests | Variable |
| Security assessment (if required) | 4-8 weeks additional |
| Final approval | 1-2 weeks after assessment |

**Total**: 4-12 weeks typical

---

## Common Rejection Reasons

### 1. Privacy Policy Issues

**Problem**: Privacy policy doesn't mention Google data
**Fix**: Add specific section about Google/YouTube data collection

### 2. Missing Scope Justifications

**Problem**: Not explaining why each scope is needed
**Fix**: Provide detailed justifications using templates above

### 3. Branding Inconsistencies

**Problem**: App name/logo doesn't match OAuth screen
**Fix**: Ensure consistency across all touchpoints

### 4. Redirect URI Issues

**Problem**: Using HTTP in production
**Fix**: All production redirect URIs must use HTTPS

### 5. Domain Not Verified

**Problem**: Domain ownership not proven
**Fix**: Complete Search Console verification

---

## Alternative: Limited Access Mode

If verification isn't feasible, operate in limited mode:

### When to Use

- Internal tools (< 100 users)
- Beta testing phase
- Development/staging environments

### How to Configure

1. Keep OAuth consent screen in "Testing" status
2. Add specific users as test users (max 100)
3. Users will see warning but can proceed

### Limitations

- 100 user maximum
- "Unverified app" warning always shown
- Tokens expire after 7 days (for sensitive scopes)
- Cannot publish to marketplace

---

## Submission Checklist

Before submitting for verification:

### Documentation
- [ ] Privacy policy URL accessible: `https://synthex.vercel.app/privacy`
- [ ] Privacy policy mentions Google/YouTube data specifically
- [ ] Terms of service URL accessible: `https://synthex.vercel.app/terms`
- [ ] Homepage URL accessible: `https://synthex.vercel.app`

### Technical
- [ ] Domain verified in Google Search Console
- [ ] All production redirect URIs use HTTPS
- [ ] OAuth client configured correctly
- [ ] All required APIs enabled

### Consent Screen
- [ ] App name matches branding
- [ ] App logo uploaded (120x120 PNG)
- [ ] Support email configured
- [ ] Developer contact emails added
- [ ] All scopes added with justifications ready

### Demo
- [ ] Demo video recorded showing OAuth flow
- [ ] Video shows each scope's usage
- [ ] Video uploaded to YouTube (unlisted) or Google Drive

### Security (for restricted scopes)
- [ ] Security documentation prepared
- [ ] Penetration test results (if available)
- [ ] Data handling procedures documented
- [ ] Incident response plan documented

---

## Resources

- [Google OAuth Verification FAQ](https://support.google.com/cloud/answer/9110914)
- [OAuth Application Verification](https://support.google.com/cloud/answer/13463073)
- [Sensitive & Restricted Scopes](https://developers.google.com/identity/protocols/oauth2/policies)
- [YouTube API Services Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service)
