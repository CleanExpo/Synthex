#!/bin/bash

echo "🚀 Quick Build Check for Vercel Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track errors
ERRORS=0

# 1. Check package.json is valid
echo -e "\n${YELLOW}1. Checking package.json...${NC}"
if node -e "require('./package.json')" 2>/dev/null; then
    echo -e "${GREEN}✓ package.json is valid${NC}"
else
    echo -e "${RED}✗ package.json has errors${NC}"
    ((ERRORS++))
fi

# 2. Check for package-lock.json
echo -e "\n${YELLOW}2. Checking package-lock.json...${NC}"
if [ -f "package-lock.json" ]; then
    echo -e "${GREEN}✓ package-lock.json exists${NC}"
else
    echo -e "${RED}✗ package-lock.json missing${NC}"
    ((ERRORS++))
fi

# 3. Quick dependency check
echo -e "\n${YELLOW}3. Checking dependencies...${NC}"
npm ls --depth=0 2>&1 | grep -q "missing:" 
if [ $? -eq 0 ]; then
    echo -e "${RED}✗ Missing dependencies found${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✓ All dependencies installed${NC}"
fi

# 4. Check Prisma schema
echo -e "\n${YELLOW}4. Validating Prisma schema...${NC}"
npx prisma validate 2>&1 | grep -q "error"
if [ $? -eq 0 ]; then
    echo -e "${RED}✗ Prisma schema has errors${NC}"
    ((ERRORS++))
else
    echo -e "${GREEN}✓ Prisma schema is valid${NC}"
fi

# 5. TypeScript quick check
echo -e "\n${YELLOW}5. Quick TypeScript check...${NC}"
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo -e "${GREEN}✓ TypeScript check passed${NC}"
else
    echo -e "${YELLOW}⚠ TypeScript has issues (showing first 20 lines)${NC}"
fi

# 6. Check critical env vars
echo -e "\n${YELLOW}6. Checking environment variables...${NC}"
MISSING_VARS=""
for var in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY DATABASE_URL JWT_SECRET NEXTAUTH_SECRET; do
    if [ -z "${!var}" ]; then
        MISSING_VARS="$MISSING_VARS $var"
    fi
done

if [ -z "$MISSING_VARS" ]; then
    echo -e "${GREEN}✓ All critical env vars present${NC}"
else
    echo -e "${YELLOW}⚠ Missing env vars:$MISSING_VARS${NC}"
fi

# 7. Test Next.js config
echo -e "\n${YELLOW}7. Testing Next.js configuration...${NC}"
node -e "require('./next.config.js')" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ next.config.js is valid${NC}"
else
    echo -e "${RED}✗ next.config.js has errors${NC}"
    ((ERRORS++))
fi

# Final report
echo -e "\n=========================================="
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Quick check PASSED - Try running full build test${NC}"
    exit 0
else
    echo -e "${RED}❌ Quick check FAILED - $ERRORS critical errors found${NC}"
    echo -e "${YELLOW}Fix these before attempting deployment${NC}"
    exit 1
fi