#!/bin/bash

# SYNTHEX Deployment Script
# Safe deployment with rollback capabilities

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV=${1:-staging}
ROLLBACK_VERSION=""
FEATURE_FLAGS_ENABLED=false

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}   SYNTHEX Deployment Script${NC}"
echo -e "${GREEN}   Environment: $DEPLOYMENT_ENV${NC}"
echo -e "${GREEN}======================================${NC}"

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker is not installed${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js is not installed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ All prerequisites met${NC}"
}

# Function to run tests
run_tests() {
    echo -e "${YELLOW}Running tests...${NC}"
    
    # Run unit tests
    npm run test:unit || {
        echo -e "${RED}Unit tests failed${NC}"
        exit 1
    }
    
    # Run integration tests if in production
    if [ "$DEPLOYMENT_ENV" = "production" ]; then
        npm run test:integration || {
            echo -e "${RED}Integration tests failed${NC}"
            exit 1
        }
    fi
    
    echo -e "${GREEN}✓ All tests passed${NC}"
}

# Function to build application
build_application() {
    echo -e "${YELLOW}Building application...${NC}"
    
    # Clean previous build
    npm run clean
    
    # Build based on environment
    if [ "$DEPLOYMENT_ENV" = "production" ]; then
        npm run build:prod
    else
        npm run build
    fi
    
    echo -e "${GREEN}✓ Build completed${NC}"
}

# Function to backup current deployment
backup_current() {
    echo -e "${YELLOW}Creating backup...${NC}"
    
    # Create backup directory
    BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $BACKUP_DIR
    
    # Backup current deployment
    if [ -d "dist" ]; then
        cp -r dist $BACKUP_DIR/
    fi
    
    if [ -d "public" ]; then
        cp -r public $BACKUP_DIR/
    fi
    
    # Save version info
    echo "Backup created at $(date)" > $BACKUP_DIR/version.txt
    git rev-parse HEAD >> $BACKUP_DIR/version.txt
    
    ROLLBACK_VERSION=$BACKUP_DIR
    echo -e "${GREEN}✓ Backup created: $BACKUP_DIR${NC}"
}

# Function to deploy with Docker
deploy_docker() {
    echo -e "${YELLOW}Deploying with Docker...${NC}"
    
    cd deployment
    
    # Stop existing containers
    docker-compose down
    
    # Build and start new containers
    if [ "$DEPLOYMENT_ENV" = "production" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
    else
        docker-compose up -d --build
    fi
    
    cd ..
    
    echo -e "${GREEN}✓ Docker deployment completed${NC}"
}

# Function to verify deployment
verify_deployment() {
    echo -e "${YELLOW}Verifying deployment...${NC}"
    
    # Wait for services to start
    sleep 10
    
    # Check health endpoints
    if curl -f http://localhost/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Web server is healthy${NC}"
    else
        echo -e "${RED}Web server health check failed${NC}"
        rollback
        exit 1
    fi
    
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API server is healthy${NC}"
    else
        echo -e "${RED}API server health check failed${NC}"
        rollback
        exit 1
    fi
    
    echo -e "${GREEN}✓ Deployment verified${NC}"
}

# Function to rollback deployment
rollback() {
    echo -e "${RED}Rolling back deployment...${NC}"
    
    if [ -n "$ROLLBACK_VERSION" ] && [ -d "$ROLLBACK_VERSION" ]; then
        # Restore from backup
        rm -rf dist public
        cp -r $ROLLBACK_VERSION/dist .
        cp -r $ROLLBACK_VERSION/public .
        
        # Restart services
        cd deployment
        docker-compose restart
        cd ..
        
        echo -e "${GREEN}✓ Rollback completed${NC}"
    else
        echo -e "${RED}No backup available for rollback${NC}"
    fi
}

# Function to enable feature flags
enable_feature_flags() {
    echo -e "${YELLOW}Configuring feature flags...${NC}"
    
    if [ "$DEPLOYMENT_ENV" = "staging" ]; then
        # Enable 10% rollout for staging
        node deployment/rollout-script.js --percentage 10
    elif [ "$DEPLOYMENT_ENV" = "production" ]; then
        # Gradual rollout for production
        node deployment/rollout-script.js --gradual
    fi
    
    echo -e "${GREEN}✓ Feature flags configured${NC}"
}

# Main deployment flow
main() {
    echo -e "${YELLOW}Starting deployment process...${NC}"
    
    # Step 1: Check prerequisites
    check_prerequisites
    
    # Step 2: Run tests
    run_tests
    
    # Step 3: Build application
    build_application
    
    # Step 4: Backup current deployment
    backup_current
    
    # Step 5: Deploy with Docker
    deploy_docker
    
    # Step 6: Configure feature flags
    if [ "$FEATURE_FLAGS_ENABLED" = true ]; then
        enable_feature_flags
    fi
    
    # Step 7: Verify deployment
    verify_deployment
    
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}   Deployment Successful!${NC}"
    echo -e "${GREEN}   Environment: $DEPLOYMENT_ENV${NC}"
    echo -e "${GREEN}   Rollback available: $ROLLBACK_VERSION${NC}"
    echo -e "${GREEN}======================================${NC}"
}

# Handle interrupts
trap rollback INT TERM

# Run main function
main

exit 0