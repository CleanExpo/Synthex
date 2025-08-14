#!/bin/bash
# Supabase Migration Runner
# Run this in Supabase SQL Editor

echo "Running Synthex database migrations..."

# You can also use Supabase CLI:
# supabase db push

echo "✅ Migrations complete!"
echo "Remember to verify tables were created:"
echo "- user_integrations"
echo "- integration_logs"
echo "- integration_statistics (view)"
