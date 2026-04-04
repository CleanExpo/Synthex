#!/bin/bash
# =============================================================================
# SQL Hardener Audit Script
# Run: ./run-audit.sh [project-ref]
# =============================================================================

set -e

PROJECT_REF="${1:-}"
OUTPUT_DIR="supabase/.audit"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "🔍 SQL Hardener Audit"
echo "===================="

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Step 1: Check Supabase CLI
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install: npm i -g supabase"
    exit 1
fi

# Step 2: Link if project ref provided
if [ -n "$PROJECT_REF" ]; then
    echo "📡 Linking to project: $PROJECT_REF"
    supabase link --project-ref "$PROJECT_REF"
fi

# Step 3: Run lint
echo ""
echo "📋 Running Supabase DB Lint..."
supabase db lint 2>&1 | tee "$OUTPUT_DIR/lint_$TIMESTAMP.txt"

# Step 4: Generate diff
echo ""
echo "📊 Generating schema diff..."
supabase db diff --linked 2>&1 | tee "$OUTPUT_DIR/diff_$TIMESTAMP.sql"

# Step 5: Dump current schema
echo ""
echo "💾 Dumping current schema..."
supabase db dump -f "$OUTPUT_DIR/schema_$TIMESTAMP.sql" 2>/dev/null || echo "⚠️ Dump failed (may need remote connection)"

# Step 6: List tables without RLS
echo ""
echo "🔒 Checking RLS status..."
cat << 'EOF' | supabase db exec --linked 2>/dev/null || echo "⚠️ RLS check skipped"
SELECT tablename,
       CASE WHEN relrowsecurity THEN '✓' ELSE '✗' END as rls
FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
ORDER BY relrowsecurity, tablename;
EOF

echo ""
echo "✅ Audit complete!"
echo "📁 Results saved to: $OUTPUT_DIR/"
echo ""
echo "Next steps:"
echo "  1. Review $OUTPUT_DIR/lint_$TIMESTAMP.txt"
echo "  2. Run audit-queries.sql against your database"
echo "  3. Create migration: supabase migration new security_hardening"
echo "  4. Test: supabase db reset"
echo "  5. Apply: supabase db push"
