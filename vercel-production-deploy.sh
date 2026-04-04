#!/bin/bash
# Vercel Production Deployment Script
# This ensures we use the production configuration

echo "=================================================="
echo "   Synthex - Production Deployment to Vercel    "
echo "=================================================="
echo ""

# Use the production configuration file
echo "Using vercel.production.json for deployment..."
echo ""

# Deploy using production config
vercel --prod -c vercel.production.json --yes

echo ""
echo "Production deployment initiated!"
echo "Check status at: https://vercel.com/dashboard"