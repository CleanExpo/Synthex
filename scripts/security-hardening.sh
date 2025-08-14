#!/bin/bash

# Security Hardening Script for CI/CD Pipeline
# Implements supply chain security best practices

echo "🔒 Starting Security Hardening..."

# 1. Lock dependencies
echo "📦 Locking dependencies..."
npm ci --ignore-scripts --audit-level=moderate

# 2. Pin Node version
echo "📌 Checking Node version..."
NODE_VERSION=$(node -v)
echo "Node version: $NODE_VERSION"

# 3. Security audit
echo "🔍 Running security audit..."
npm audit --omit=dev

# 4. License check
echo "📜 Checking licenses..."
npx license-checker --production --summary

# 5. Generate SBOM
echo "📋 Generating SBOM..."
node scripts/generate-sbom.js

# 6. Verify no secrets in code
echo "🔐 Scanning for secrets..."
# Using basic patterns - in production use truffleHog or similar
grep -r -E "(api_key|apikey|secret|password|token)" \
  --exclude-dir=node_modules \
  --exclude-dir=.git \
  --exclude-dir=.next \
  --exclude="*.lock" \
  --exclude="*.log" \
  src/ || echo "No secrets found"

# 7. Check for vulnerable patterns
echo "⚠️ Checking for vulnerable patterns..."
grep -r -E "(eval\(|exec\(|Function\(|innerHTML)" \
  --include="*.js" \
  --include="*.ts" \
  --include="*.jsx" \
  --include="*.tsx" \
  --exclude-dir=node_modules \
  src/ || echo "No dangerous patterns found"

echo "✅ Security hardening complete"