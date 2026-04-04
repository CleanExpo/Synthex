#!/bin/bash

echo "========================================"
echo "Clearing Next.js Build Cache"
echo "========================================"
echo ""

if [ -d ".next" ]; then
    echo "Deleting .next cache..."
    rm -rf .next
    echo ".next deleted successfully."
else
    echo ".next directory not found. Nothing to delete."
fi

echo ""

if [ -d "node_modules/.cache" ]; then
    echo "Deleting node_modules cache..."
    rm -rf node_modules/.cache
    echo "node_modules cache deleted successfully."
else
    echo "node_modules cache not found. Nothing to delete."
fi

echo ""

if [ -d ".turbo" ]; then
    echo "Deleting .turbo cache..."
    rm -rf .turbo
    echo ".turbo deleted successfully."
else
    echo ".turbo directory not found. Nothing to delete."
fi

echo ""
echo "========================================"
echo "Cache clearing complete!"
echo "========================================"
echo ""
echo "You can now run: npm run build"
echo ""