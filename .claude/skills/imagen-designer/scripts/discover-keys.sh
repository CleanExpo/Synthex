#!/bin/bash
#
# discover-keys.sh — Environment Discovery for Imagen Generation
# Synthex AI Agency · imagen-designer skill
#
# Discovers and validates API keys for image generation services.
# Sources this script to set environment variables for generation scripts.
#
# Usage:
#   source .claude/skills/imagen-designer/scripts/discover-keys.sh
#

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Imagen Designer — Environment Discovery${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Track discovery status
KEYS_FOUND=0
KEYS_MISSING=0

# Function to check and export a key
check_key() {
    local key_name=$1
    local env_files=(".env.local" ".env" ".env.production.local" ".env.production")
    local key_value=""

    # First check if already in environment
    if [ -n "${!key_name}" ]; then
        key_value="${!key_name}"
        echo -e "  ${GREEN}✓${NC} $key_name (from environment)"
        ((KEYS_FOUND++))
        return 0
    fi

    # Search through env files
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            # Extract key value, handling quotes
            key_value=$(grep "^${key_name}=" "$env_file" 2>/dev/null | cut -d'=' -f2- | sed 's/^["'"'"']//;s/["'"'"']$//' | head -1)
            if [ -n "$key_value" ]; then
                export "$key_name"="$key_value"
                echo -e "  ${GREEN}✓${NC} $key_name (from $env_file)"
                ((KEYS_FOUND++))
                return 0
            fi
        fi
    done

    # Key not found
    echo -e "  ${RED}✗${NC} $key_name (not found)"
    ((KEYS_MISSING++))
    return 1
}

# Function to validate key format
validate_key() {
    local key_name=$1
    local key_value="${!key_name}"
    local min_length=$2

    if [ ${#key_value} -lt $min_length ]; then
        echo -e "  ${YELLOW}⚠${NC} $key_name appears invalid (too short)"
        return 1
    fi
    return 0
}

echo "Discovering API keys..."
echo ""

# Primary: Google Gemini API Key
echo -e "${YELLOW}Google AI / Gemini:${NC}"
if check_key "GEMINI_API_KEY"; then
    validate_key "GEMINI_API_KEY" 20
fi

# Alternative: Google Cloud credentials for Imagen
echo ""
echo -e "${YELLOW}Google Cloud (Imagen):${NC}"
check_key "GOOGLE_API_KEY" || true
check_key "GOOGLE_APPLICATION_CREDENTIALS" || true

# Vertex AI for enterprise Imagen
echo ""
echo -e "${YELLOW}Vertex AI:${NC}"
check_key "VERTEX_AI_PROJECT" || true
check_key "VERTEX_AI_LOCATION" || true

# OpenRouter API (fallback for image generation)
echo ""
echo -e "${YELLOW}OpenRouter API:${NC}"
check_key "OPENROUTER_API_KEY" || true

# Alternative image generation services
echo ""
echo -e "${YELLOW}Alternative Services:${NC}"
check_key "STABILITY_API_KEY" || true
check_key "OPENAI_API_KEY" || true
check_key "REPLICATE_API_TOKEN" || true

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Summary
if [ $KEYS_FOUND -gt 0 ]; then
    echo -e "${GREEN}Found $KEYS_FOUND API key(s)${NC}"
else
    echo -e "${RED}No API keys found!${NC}"
fi

if [ $KEYS_MISSING -gt 0 ]; then
    echo -e "${YELLOW}Missing $KEYS_MISSING optional key(s)${NC}"
fi

echo ""

# Critical check: At least one image generation key must be available
if [ -z "$GEMINI_API_KEY" ] && [ -z "$GOOGLE_API_KEY" ] && [ -z "$OPENROUTER_API_KEY" ] && [ -z "$STABILITY_API_KEY" ] && [ -z "$OPENAI_API_KEY" ]; then
    echo -e "${RED}ERROR: No image generation API key available!${NC}"
    echo ""
    echo "Please set one of the following:"
    echo "  - GEMINI_API_KEY (recommended)"
    echo "  - OPENROUTER_API_KEY (fallback)"
    echo "  - GOOGLE_API_KEY"
    echo "  - STABILITY_API_KEY"
    echo "  - OPENAI_API_KEY"
    echo ""
    echo "Add to .env.local:"
    echo "  GEMINI_API_KEY=your-api-key-here"
    echo "  # or"
    echo "  OPENROUTER_API_KEY=your-openrouter-key"
    echo ""
    # Don't exit with error when sourced, just set a flag
    export IMAGEN_KEYS_AVAILABLE=false
else
    echo -e "${GREEN}Image generation is available!${NC}"
    export IMAGEN_KEYS_AVAILABLE=true

    # Set preferred provider (priority order)
    if [ -n "$GEMINI_API_KEY" ]; then
        export IMAGEN_PROVIDER="gemini"
    elif [ -n "$GOOGLE_API_KEY" ]; then
        export IMAGEN_PROVIDER="google"
    elif [ -n "$OPENROUTER_API_KEY" ]; then
        export IMAGEN_PROVIDER="openrouter"
    elif [ -n "$STABILITY_API_KEY" ]; then
        export IMAGEN_PROVIDER="stability"
    elif [ -n "$OPENAI_API_KEY" ]; then
        export IMAGEN_PROVIDER="openai"
    fi
    echo -e "Using provider: ${BLUE}$IMAGEN_PROVIDER${NC}"
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
