# 🚀 SYNTHEX Production Setup Guide

## Overview
This guide will help you deploy SYNTHEX with a complete user authentication system, database persistence, and secure API key management.

## ✅ What's Included
- **User Authentication**: JWT-based login/registration system
- **Database**: PostgreSQL with Prisma ORM for user accounts, campaigns, and analytics
- **API Key Management**: Encrypted storage of user OpenRouter/Anthropic API keys
- **User Dashboard**: Beautiful interface at `/dashboard` for account management
- **Usage Tracking**: Real-time API usage and cost analytics
- **Rate Limiting**: Security protection for authentication endpoints
- **Real Data**: No more mock data - everything is persisted in the database

## 🗄️ Database Setup

### Option 1: Vercel Postgres (Recommended for Production)

1. **Create Vercel Postgres Database**
   ```bash
   # In your Vercel dashboard
   1. Go to Storage tab
   2. Create new Postgres database
   3. Copy connection strings
   ```

2. **Set Environment Variables in Vercel**
   ```env
   # Database (provided by Vercel Postgres)
   POSTGRES_URL="postgresql://..."
   POSTGRES_PRISMA_URL="postgresql://..."
   POSTGRES_URL_NO_SSL="postgresql://..."
   POSTGRES_URL_NON_POOLING="postgresql://..."
   
   # Required for the app
   DATABASE_URL="${POSTGRES_PRISMA_URL}"
   JWT_SECRET="your-super-secure-64-character-secret-key-for-production-use"
   
   # Optional: System-wide API keys (users can add their own)
   OPENROUTER_API_KEY="sk-or-v1-your-key"
   ANTHROPIC_API_KEY="sk-ant-api-your-key"
   OPENROUTER_SITE_URL="https://your-app.vercel.app"
   OPENROUTER_SITE_NAME="SYNTHEX Marketing Platform"
   ```

3. **Deploy and Migrate Database**
   ```bash
   # After Vercel deployment
   npm run db:migrate:prod
   ```

### Option 2: Local Development Database

1. **Install PostgreSQL**
   - Download and install PostgreSQL
   - Create a database: `createdb auto_marketing`

2. **Set Environment Variables**
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/auto_marketing"
   JWT_SECRET="your-super-secure-64-character-secret-key-for-development"
   ```

3. **Run Migrations**
   ```bash
   npm run db:migrate
   npm run db:generate
   ```

## 🔐 Security Configuration

### 1. JWT Secret
Generate a secure JWT secret (minimum 64 characters):
```bash
# Generate secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2. API Key Encryption
User API keys are automatically encrypted using AES-256-CBC. The JWT secret is used as the encryption key.

### 3. Rate Limiting
Built-in rate limiting protects against abuse:
- **Authentication**: 5 attempts per 15 minutes per IP
- **Registration**: 3 attempts per hour per IP
- **API calls**: 20 per minute, 10 for content generation

## 🎯 User Journey

### 1. User Registration
- Users visit `/dashboard`
- Create account with email/password (strong password required)
- Automatic JWT token generation and storage

### 2. API Key Setup
- Users add their own OpenRouter/Anthropic API keys
- Keys are encrypted and stored securely in database
- Real-time status indicators show configuration state

### 3. Content Generation
- All API calls now use user-specific API keys when available
- Falls back to system keys for unauthenticated users
- Usage tracking and cost analytics per user

### 4. Dashboard Features
- Real-time usage statistics
- API key management with masked display
- Connection testing
- Quick access to all UI variants

## 📊 Database Schema

### Users Table
- **id**: Unique identifier
- **email**: User email (unique)
- **password**: Bcrypt hashed password
- **name**: Optional display name
- **openrouterApiKey**: Encrypted API key
- **anthropicApiKey**: Encrypted API key
- **preferences**: JSON user settings

### Campaigns Table
- **id**: Campaign identifier
- **name**: Campaign name
- **platform**: Target platform
- **status**: Draft/Active/Paused/Completed
- **content**: Generated content and variations
- **analytics**: Performance metrics

### API Usage Table
- **endpoint**: API endpoint used
- **model**: AI model used
- **tokens**: Token consumption
- **cost**: Request cost
- **status**: Success/Error/Rate limited
- **requestData**: Request details
- **responseData**: Response details

## 🚀 Deployment Steps

### 1. Prepare Repository
```bash
# Your code is already ready - just ensure environment variables are set
git push origin main
```

### 2. Deploy to Vercel
```bash
# Connect your GitHub repo to Vercel
# Set environment variables in Vercel dashboard
# Deploy automatically triggers
```

### 3. Initialize Database
```bash
# After first deployment
vercel env pull .env.local
npm run db:migrate:prod

# Or use Vercel CLI
npx vercel env add DATABASE_URL
```

### 4. Test Production
1. Visit `https://your-app.vercel.app/dashboard`
2. Create test account
3. Add API keys
4. Test content generation
5. Verify usage tracking

## 🔧 Environment Variables Checklist

### Required
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `JWT_SECRET` - Secure 64+ character secret
- ✅ `NODE_ENV` - Set to "production"

### Optional (System Fallback)
- `OPENROUTER_API_KEY` - System-wide OpenRouter key
- `ANTHROPIC_API_KEY` - System-wide Anthropic key
- `OPENROUTER_SITE_URL` - Your app URL for OpenRouter
- `OPENROUTER_SITE_NAME` - App name for OpenRouter

### Vercel Postgres (Auto-provided)
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NO_SSL`
- `POSTGRES_URL_NON_POOLING`

## 🎨 User Interface Access

- **Modern UI**: `https://your-app.vercel.app/` (main interface)
- **User Dashboard**: `https://your-app.vercel.app/dashboard` (account management)
- **Classic UI**: `https://your-app.vercel.app/classic` (alternative interface)
- **API Documentation**: `https://your-app.vercel.app/api` (endpoint list)

## 🧪 Testing Checklist

### Authentication Flow
- [ ] User registration with strong password
- [ ] User login with JWT token
- [ ] Profile display and logout
- [ ] Rate limiting protection

### API Key Management
- [ ] Add OpenRouter API key
- [ ] Add Anthropic API key
- [ ] View masked keys in dashboard
- [ ] Test API connection

### Content Generation
- [ ] Generate marketing content with user API key
- [ ] Test content optimization
- [ ] Generate content variations
- [ ] Verify fallback to system keys

### Usage Tracking
- [ ] API calls logged to database
- [ ] Usage statistics displayed
- [ ] Cost tracking functional
- [ ] Error rate calculation

### Database Persistence
- [ ] User accounts persist across sessions
- [ ] API keys encrypted in database
- [ ] Usage history maintained
- [ ] Database migrations work

## 🆘 Troubleshooting

### Database Connection Issues
```bash
# Test database connection
npm run db:studio

# Reset and re-migrate
npm run db:reset
npm run db:migrate:prod
```

### Authentication Problems
- Verify JWT_SECRET is set and consistent
- Check password requirements (8+ chars, mixed case, number, special)
- Ensure CORS is configured for your domain

### API Key Issues
- Verify API keys are valid format
- Check encryption/decryption is working
- Test with both user and system keys

### Performance Issues
- Monitor database connection pool
- Check rate limiting logs
- Optimize heavy queries with indexes

## 🎉 Success!

Your SYNTHEX platform is now a fully functional SaaS application with:
- ✅ Multi-user authentication system
- ✅ Secure API key management
- ✅ Real-time usage analytics
- ✅ Database-driven content generation
- ✅ Beautiful user dashboard
- ✅ Production-ready deployment

Users can now create accounts, manage their API keys, generate real marketing content, and track their usage - all with their own secure credentials and data!