#!/bin/bash

# SYNTHEX Restore Script
# Restore the application from a backup

set -e # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 SYNTHEX Restore Script${NC}"
echo "========================="

# Check if backup file is provided
if [ $# -eq 0 ]; then
  echo -e "${RED}Error: No backup file specified${NC}"
  echo "Usage: ./scripts/restore.sh <backup-file.tar.gz>"
  echo ""
  echo "Available backups:"
  ls -la backups/*.tar.gz 2>/dev/null || echo "No backups found in ./backups/"
  exit 1
fi

BACKUP_FILE=$1
RESTORE_DIR="synthex-restore-$(date +%Y%m%d_%H%M%S)"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  # Try in backups directory
  if [ -f "backups/$BACKUP_FILE" ]; then
    BACKUP_FILE="backups/$BACKUP_FILE"
  else
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
  fi
fi

echo "Backup file: $BACKUP_FILE"
echo "Restore directory: $RESTORE_DIR"
echo ""

# Verify checksum if available
CHECKSUM_FILE="${BACKUP_FILE%.tar.gz}.sha256"
if [ -f "$CHECKSUM_FILE" ]; then
  echo -e "${YELLOW}🔍 Verifying backup integrity...${NC}"
  if command -v sha256sum &> /dev/null; then
    sha256sum -c "$CHECKSUM_FILE"
  elif command -v shasum &> /dev/null; then
    shasum -a 256 -c "$CHECKSUM_FILE"
  fi
fi

# Create restore directory
echo -e "${YELLOW}📁 Creating restore directory...${NC}"
mkdir -p $RESTORE_DIR

# Extract backup
echo -e "${YELLOW}📦 Extracting backup...${NC}"
tar -xzf $BACKUP_FILE -C $RESTORE_DIR --strip-components=1

# Check manifest
if [ -f "$RESTORE_DIR/manifest.json" ]; then
  echo -e "${YELLOW}📋 Backup information:${NC}"
  cat $RESTORE_DIR/manifest.json | python3 -m json.tool 2>/dev/null || cat $RESTORE_DIR/manifest.json
  echo ""
fi

# Restore code
echo -e "${YELLOW}📁 Restoring application code...${NC}"
if [ -d "$RESTORE_DIR/code" ]; then
  cp -r $RESTORE_DIR/code/* ./
fi

# Restore environment variables
if [ -f "$RESTORE_DIR/.env" ]; then
  echo -e "${YELLOW}🔐 Found environment variables backup${NC}"
  echo "Do you want to restore .env file? (y/n)"
  read -r response
  if [[ "$response" =~ ^[Yy]$ ]]; then
    cp $RESTORE_DIR/.env .env
    echo "Environment variables restored"
  fi
fi

# Restore package files
if [ -f "$RESTORE_DIR/package.json" ]; then
  echo -e "${YELLOW}📦 Restoring package files...${NC}"
  cp $RESTORE_DIR/package.json ./package.json
  cp $RESTORE_DIR/package-lock.json ./package-lock.json 2>/dev/null || true
fi

# Install dependencies
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
echo "Do you want to install npm dependencies? (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
  npm ci || npm install
fi

# Show git information
if [ -f "$RESTORE_DIR/git-commit.txt" ]; then
  echo -e "${YELLOW}📝 Git information from backup:${NC}"
  echo "Commit: $(cat $RESTORE_DIR/git-commit.txt)"
  if [ -f "$RESTORE_DIR/git-log.txt" ]; then
    echo "Recent commits:"
    head -5 $RESTORE_DIR/git-log.txt
  fi
fi

# Clean up
echo -e "${YELLOW}🧹 Cleaning up...${NC}"
rm -rf $RESTORE_DIR

echo ""
echo -e "${GREEN}✅ Restore completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Verify the restored files"
echo "2. Update .env with current values if needed"
echo "3. Run 'npm run dev' to test locally"
echo "4. Deploy with 'vercel --prod' when ready"