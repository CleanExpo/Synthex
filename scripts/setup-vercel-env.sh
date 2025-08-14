#!/bin/bash

# Setup Vercel Environment Variables
echo "🚀 Setting up Vercel Environment Variables for SYNTHEX"

# Supabase Configuration
vercel env add NEXT_PUBLIC_SUPABASE_URL production <<< "https://znyjoyjsvjotlzjppzal.supabase.co"
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueWpveWpzdmpvdGx6anBwemFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQyNjc1NTcsImV4cCI6MjA2OTg0MzU1N30.mOBWTEMF9tYKnRqqqVbCgLMteFKD2w85uTQDatt_b9Y"
vercel env add SUPABASE_SERVICE_ROLE_KEY production <<< "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpueWpveWpzdmpvdGx6anBwemFsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDI2NzU1NywiZXhwIjoyMDY5ODQzNTU3fQ.ZdjG_wBP6pJb1uVzrUVdyWfqlzPYyPbKwlXktWvE3mk"

# Database URLs
vercel env add DATABASE_URL production <<< "postgresql://postgres:postgres@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres"
vercel env add DIRECT_URL production <<< "postgresql://postgres:postgres@db.znyjoyjsvjotlzjppzal.supabase.co:5432/postgres"

# Security Keys
vercel env add JWT_SECRET production <<< "NE1Fi3OY5gM879XiUrYI3lH7GoJwEffQhfw7YOz7nplXPd5sqW9THhT9l9SzX/EED1XhTr0A8C8ZMZomMAUbvw=="
vercel env add SESSION_SECRET production <<< "NE1Fi3OY5gM879XiUrYI3lH7GoJwEffQhfw7YOz7nplXPd5sqW9THhT9l9SzX/EED1XhTr0A8C8ZMZomMAUbvw=="
vercel env add CRON_SECRET production <<< "NE1Fi3OY5gM879XiUrYI3lH7GoJwEffQhfw7YOz7nplXPd5sqW9THhT9l9SzX"
vercel env add ADMIN_API_KEY production <<< "sk_salt_2025_synthex_integration"

# OpenRouter API
vercel env add OPENROUTER_API_KEY production <<< "sk-or-v1-synthex2025"
vercel env add OPENROUTER_BASE_URL production <<< "https://openrouter.ai/api/v1"
vercel env add OPENROUTER_MODEL production <<< "gpt-4-turbo-preview"

# Application URL
vercel env add NEXT_PUBLIC_APP_URL production <<< "https://synthex.social"

# Feature Flags
vercel env add ENABLE_STRATEGIC_MARKETING production <<< "true"
vercel env add ENABLE_AB_TESTING production <<< "true"
vercel env add ENABLE_PSYCHOLOGY_ANALYTICS production <<< "true"

# Node Environment
vercel env add NODE_ENV production <<< "production"

echo "✅ Environment variables set! Deploy with: vercel --prod"