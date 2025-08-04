# 🚀 Google Cloud Integration Guide for SYNTHEX

## Overview
This comprehensive guide will walk you through setting up Google Authentication, Google Cloud SQL, and other Google services for your SYNTHEX platform.

## 📋 Table of Contents
1. [Google Cloud Console Setup](#google-cloud-console-setup)
2. [Google OAuth 2.0 Configuration](#google-oauth-20-configuration)
3. [Google Cloud SQL Database](#google-cloud-sql-database)
4. [Additional Google APIs](#additional-google-apis)
5. [Integration Steps](#integration-steps)
6. [Environment Variables](#environment-variables)
7. [Testing](#testing)

---

## 🌐 Google Cloud Console Setup

### Step 1: Create Google Cloud Project

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Sign in with your Google account

2. **Create New Project**
   ```
   1. Click "Select a project" dropdown at the top
   2. Click "New Project"
   3. Project Name: "SYNTHEX Marketing Platform"
   4. Organization: (Select if applicable)
   5. Location: (Select appropriate location)
   6. Click "Create"
   ```

3. **Enable Billing**
   ```
   1. Go to Billing section
   2. Link a billing account (required for most services)
   3. Set up budget alerts (recommended: $50/month initially)
   ```

### Step 2: Enable Required APIs

Navigate to **APIs & Services > Library** and enable these APIs:

#### Required APIs:
- ✅ **Google+ API** (for Sign-In)
- ✅ **Identity and Access Management (IAM) API**
- ✅ **Cloud SQL API** (for database)
- ✅ **Cloud SQL Admin API**

#### Optional APIs (for enhanced features):
- 🔧 **Gmail API** (for email marketing)
- 🔧 **YouTube Data API v3** (for YouTube content)
- 🔧 **Google Analytics Reporting API**
- 🔧 **Google Ads API**
- 🔧 **Google My Business API**

---

## 🔐 Google OAuth 2.0 Configuration

### Step 1: Configure OAuth Consent Screen

1. **Go to APIs & Services > OAuth consent screen**

2. **Choose User Type**
   - **External**: For public users (recommended for SaaS)
   - **Internal**: Only for Google Workspace users

3. **OAuth Consent Screen Configuration**
   ```
   App name: SYNTHEX Marketing Platform
   User support email: your-email@domain.com
   App logo: (Upload your logo - 120x120px PNG/JPG)
   App domain: https://your-app.vercel.app
   Authorized domains: 
     - your-domain.com
     - vercel.app
   Developer contact: your-email@domain.com
   ```

4. **Scopes** (Add these scopes)
   ```
   - ../auth/userinfo.email
   - ../auth/userinfo.profile
   - openid
   ```

5. **Test Users** (for development)
   - Add your email and team members' emails

### Step 2: Create OAuth 2.0 Credentials

1. **Go to APIs & Services > Credentials**

2. **Click "Create Credentials" > OAuth 2.0 Client IDs**

3. **Configure OAuth Client**
   ```
   Application type: Web application
   Name: SYNTHEX Web Client
   
   Authorized JavaScript origins:
     - http://localhost:3000 (for development)
     - https://your-app.vercel.app (for production)
   
   Authorized redirect URIs:
     - http://localhost:3000/auth/google/callback (development)
     - https://your-app.vercel.app/auth/google/callback (production)
   ```

4. **Save Credentials**
   - Download the JSON file
   - Note the **Client ID** and **Client Secret**

---

## 🗄️ Google Cloud SQL Database

### Step 1: Create Cloud SQL Instance

1. **Go to SQL section in Google Cloud Console**

2. **Create Instance**
   ```
   Database engine: PostgreSQL
   Instance ID: synthex-db
   Password: (Generate strong password)
   Database version: PostgreSQL 15
   Cloud SQL edition: Enterprise (or Standard for smaller scale)
   
   Region: (Choose closest to your users)
   Zonal availability: Single zone (or Multiple zones for HA)
   
   Machine configuration:
     - Shared core (1 vCPU, 0.614 GB) for development
     - Standard (1-2 vCPU, 3.75-7.5 GB) for production
   
   Storage:
     - Type: SSD
     - Capacity: 10 GB (auto-increase enabled)
   ```

3. **Configure Connections**
   ```
   Authorized networks:
     - 0.0.0.0/0 (for development - restrict in production)
   
   Private IP: (Enable for enhanced security)
   SSL: Required
   ```

### Step 2: Create Database and User

1. **Connect to your instance** (using Cloud Shell or local client)

2. **Create Database**
   ```sql
   CREATE DATABASE synthex_production;
   ```

3. **Create Application User**
   ```sql
   CREATE USER synthex_app WITH PASSWORD 'your-secure-password';
   GRANT ALL PRIVILEGES ON DATABASE synthex_production TO synthex_app;
   ```

### Step 3: Get Connection Details

1. **Connection String Format:**
   ```
   postgresql://synthex_app:password@google-cloud-sql-ip:5432/synthex_production
   ```

2. **For Google Cloud Run/App Engine:**
   ```
   postgresql://synthex_app:password@/synthex_production?host=/cloudsql/project-id:region:instance-id
   ```

---

## 🛠️ Additional Google APIs Setup

### Google Analytics 4 (Optional)

1. **Create GA4 Property**
   - Go to: https://analytics.google.com/
   - Create new property for your domain

2. **Get Measurement ID**
   - Format: `G-XXXXXXXXXX`

### Google Ads API (Optional)

1. **Apply for Google Ads API access**
   - Go to: https://developers.google.com/google-ads/api
   - Complete application process

2. **Create Developer Token**
   - Available in Google Ads account under Tools & Settings

### Google My Business API (Optional)

1. **Enable Google My Business API**
2. **Set up service account** for server-to-server auth

---

## 🔧 Integration Steps

### Step 1: Install Dependencies

```bash
npm install passport passport-google-oauth20 @google-cloud/sql-connector
```

### Step 2: Update Environment Variables

Create/update your `.env` file:

```env
# Google Authentication
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="https://your-app.vercel.app/auth/google/callback"

# Google Cloud SQL
GOOGLE_CLOUD_SQL_CONNECTION_NAME="project-id:region:instance-id"
GOOGLE_CLOUD_SQL_DATABASE="synthex_production"
GOOGLE_CLOUD_SQL_USER="synthex_app"
GOOGLE_CLOUD_SQL_PASSWORD="your-secure-password"

# Alternative: Direct connection string
DATABASE_URL="postgresql://synthex_app:password@google-cloud-sql-ip:5432/synthex_production"

# Google APIs (Optional)
GOOGLE_ANALYTICS_MEASUREMENT_ID="G-XXXXXXXXXX"
GOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Existing variables
JWT_SECRET="your-jwt-secret"
OPENROUTER_API_KEY="your-openrouter-key"
```

### Step 3: Google Auth Strategy Implementation

I'll create the passport configuration and routes for you in the next step.

---

## 📊 Google Cloud Console Navigation

### Quick Access URLs:

- **Project Dashboard**: `https://console.cloud.google.com/home/dashboard?project=YOUR_PROJECT_ID`
- **APIs & Services**: `https://console.cloud.google.com/apis/dashboard?project=YOUR_PROJECT_ID`
- **OAuth Consent Screen**: `https://console.cloud.google.com/apis/credentials/consent?project=YOUR_PROJECT_ID`
- **Credentials**: `https://console.cloud.google.com/apis/credentials?project=YOUR_PROJECT_ID`
- **Cloud SQL**: `https://console.cloud.google.com/sql/instances?project=YOUR_PROJECT_ID`
- **IAM & Admin**: `https://console.cloud.google.com/iam-admin/iam?project=YOUR_PROJECT_ID`
- **Billing**: `https://console.cloud.google.com/billing?project=YOUR_PROJECT_ID`

### Project Settings Checklist:

- [ ] Project created and selected
- [ ] Billing account linked
- [ ] Required APIs enabled
- [ ] OAuth consent screen configured
- [ ] OAuth 2.0 credentials created
- [ ] Cloud SQL instance created
- [ ] Database and user created
- [ ] Connection string obtained
- [ ] Environment variables configured

---

## 🔒 Security Best Practices

### OAuth Configuration:
- Use HTTPS in production
- Restrict authorized domains
- Regularly rotate client secrets
- Monitor OAuth usage in console

### Cloud SQL Security:
- Enable SSL/TLS connections
- Use private IP when possible
- Implement connection pooling
- Regular security updates
- Monitor database access logs

### API Key Management:
- Use service accounts for server-to-server
- Implement API key restrictions
- Monitor API usage and quotas
- Set up alerts for unusual activity

---

## 💰 Cost Estimation

### Cloud SQL Pricing (Approximate):
- **Development**: $7-15/month (shared core, 10GB)  
- **Small Production**: $25-50/month (standard, 20GB)
- **Medium Production**: $100-200/month (high memory, 100GB)

### API Usage:
- **OAuth Sign-in**: Free (up to limits)
- **Google APIs**: Varies by service and usage
- **Cloud Functions**: Pay per invocation

### Monitoring Tools:
- Set up budget alerts
- Use Cloud Monitoring for performance
- Enable audit logs for security

---

## 🧪 Testing Checklist

### OAuth Flow:
- [ ] Development login works (localhost:3000)
- [ ] Production login works (your-domain.com)
- [ ] User info properly retrieved
- [ ] Tokens stored securely
- [ ] Logout functionality works

### Database Connection:
- [ ] Connection string works
- [ ] SSL connection established
- [ ] Database queries execute
- [ ] Connection pooling configured
- [ ] Backup and recovery tested

### API Integration:
- [ ] Google APIs respond correctly
- [ ] Rate limits respected
- [ ] Error handling implemented
- [ ] Usage monitoring active

---

## 🆘 Troubleshooting

### Common OAuth Issues:
```
Error: redirect_uri_mismatch
→ Check authorized redirect URIs in console

Error: invalid_client
→ Verify client ID and secret are correct

Error: access_denied
→ Check OAuth consent screen approval status
```

### Cloud SQL Connection Issues:
```
Error: connection refused
→ Check authorized networks and firewall rules

Error: authentication failed
→ Verify username, password, and SSL settings

Error: too many connections
→ Implement connection pooling
```

### API Quota Issues:
```
Error: quotaExceeded
→ Check API quotas in console and request increases

Error: rateLimitExceeded
→ Implement exponential backoff
```

---

This guide provides everything you need to integrate Google services with your SYNTHEX platform. The next step is implementing the actual authentication code - would you like me to create the Passport.js Google OAuth integration?