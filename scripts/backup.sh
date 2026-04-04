#!/bin/bash

# SYNTHEX Backup Script
# Run this script to create a complete backup of the application

set -e # Exit on error

# Configuration
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="synthex_backup_$DATE"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 SYNTHEX Backup Script${NC}"
echo "========================="
echo "Backup ID: $BACKUP_NAME"
echo ""

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR/$BACKUP_NAME

# 1. Backup code (excluding node_modules and .next)
echo -e "${YELLOW}📁 Backing up application code...${NC}"
rsync -av --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'backups' \
  --exclude '.git' \
  --exclude '*.log' \
  ./ $BACKUP_DIR/$BACKUP_NAME/code/

# 2. Backup environment variables (encrypted)
if [ -f .env ]; then
  echo -e "${YELLOW}🔐 Backing up environment variables...${NC}"
  cp .env $BACKUP_DIR/$BACKUP_NAME/.env
  # Optional: Encrypt the env file
  # gpg --symmetric --cipher-algo AES256 $BACKUP_DIR/$BACKUP_NAME/.env
  # rm $BACKUP_DIR/$BACKUP_NAME/.env
fi

# 3. Backup git information
echo -e "${YELLOW}📝 Backing up git information...${NC}"
git log --oneline -n 100 > $BACKUP_DIR/$BACKUP_NAME/git-log.txt
git status > $BACKUP_DIR/$BACKUP_NAME/git-status.txt
git remote -v > $BACKUP_DIR/$BACKUP_NAME/git-remotes.txt
echo $(git rev-parse HEAD) > $BACKUP_DIR/$BACKUP_NAME/git-commit.txt

# 4. Backup package information
echo -e "${YELLOW}📦 Backing up package information...${NC}"
cp package.json $BACKUP_DIR/$BACKUP_NAME/
cp package-lock.json $BACKUP_DIR/$BACKUP_NAME/

# 5. Create backup manifest
echo -e "${YELLOW}📋 Creating backup manifest...${NC}"
cat > $BACKUP_DIR/$BACKUP_NAME/manifest.json <<EOF
{
  "backup_id": "$BACKUP_NAME",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "node_version": "$(node -v)",
  "npm_version": "$(npm -v)",
  "git_commit": "$(git rev-parse HEAD)",
  "git_branch": "$(git branch --show-current)",
  "files_count": $(find $BACKUP_DIR/$BACKUP_NAME/code -type f | wc -l),
  "total_size": "$(du -sh $BACKUP_DIR/$BACKUP_NAME | cut -f1)"
}
EOF

# 6. Compress the backup
echo -e "${YELLOW}📦 Compressing backup...${NC}"
cd $BACKUP_DIR
tar -czf $BACKUP_NAME.tar.gz $BACKUP_NAME/
rm -rf $BACKUP_NAME/

# 7. Calculate checksum
echo -e "${YELLOW}🔍 Calculating checksum...${NC}"
if command -v sha256sum &> /dev/null; then
  sha256sum $BACKUP_NAME.tar.gz > $BACKUP_NAME.sha256
elif command -v shasum &> /dev/null; then
  shasum -a 256 $BACKUP_NAME.tar.gz > $BACKUP_NAME.sha256
fi

# 8. Clean old backups (keep last 10)
echo -e "${YELLOW}🧹 Cleaning old backups...${NC}"
ls -t *.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm --

echo ""
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo "Location: $BACKUP_DIR/$BACKUP_NAME.tar.gz"
echo "Size: $(du -h $BACKUP_NAME.tar.gz | cut -f1)"
if [ -f $BACKUP_NAME.sha256 ]; then
  echo "Checksum: $(cat $BACKUP_NAME.sha256 | cut -d' ' -f1)"
fi
echo ""
echo "To restore from this backup, run:"
echo "  ./scripts/restore.sh $BACKUP_NAME.tar.gz"