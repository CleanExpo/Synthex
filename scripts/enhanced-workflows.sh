#!/bin/bash

# SYNTHEX Enhanced Workflow Scripts
# Leverages Claude Code's improved bash validation for safer execution

set -euo pipefail  # Enhanced error handling
IFS=$'\n\t'       # Improved word splitting

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function: Start development with specific MCP configuration
start_dev() {
    log "Starting development environment with enhanced MCP servers..."
    
    # Check if MCP configs exist
    if [[ ! -f "mcp.development.json" ]]; then
        error "mcp.development.json not found!"
        exit 1
    fi
    
    # Start Claude Code with development MCPs
    claude code --mcp-config mcp.development.json mcp.config.json &
    
    # Start development server
    npm run dev &
    
    success "Development environment started with Context7 and IDE integration"
    log "Access at http://localhost:3000"
}

# Function: Run marketing workflow with specialized MCPs
marketing_workflow() {
    log "Starting marketing workflow with specialized MCPs..."
    
    # Load marketing and development configs
    claude code --mcp-config mcp.marketing.json mcp.development.json &
    
    success "Marketing workflow ready with:"
    echo "  - Context7 for documentation"
    echo "  - Playwright for testing"
    echo "  - Sequential Thinking for strategy"
}

# Function: Deploy with safety checks (uses enhanced validation)
safe_deploy() {
    log "Starting safe deployment process..."
    
    # Pre-deployment checks
    log "Running pre-deployment validation..."
    
    # 1. Check for uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        warning "Uncommitted changes detected!"
        read -p "Continue with deployment? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment cancelled"
            exit 1
        fi
    fi
    
    # 2. Run tests
    log "Running test suite..."
    if ! npm test; then
        error "Tests failed! Aborting deployment."
        exit 1
    fi
    
    # 3. Build project
    log "Building project..."
    if ! npm run build; then
        error "Build failed! Aborting deployment."
        exit 1
    fi
    
    # 4. Run Playwright E2E tests
    log "Running E2E tests with Playwright MCP..."
    claude code --mcp-config mcp.deployment.json --command "node tests/playwright/marketing-ui.test.js"
    
    # 5. Deploy to Vercel
    log "Deploying to Vercel..."
    vercel --prod --yes
    
    # 6. Run post-deployment health checks
    log "Running health checks..."
    sleep 10  # Wait for deployment to stabilize
    
    HEALTH_ENDPOINTS=(
        "/api/health"
        "/api/auth/session"
        "/api/ai/status"
    )
    
    for endpoint in "${HEALTH_ENDPOINTS[@]}"; do
        if curl -f -s "https://synthex.vercel.app${endpoint}" > /dev/null; then
            success "Health check passed: ${endpoint}"
        else
            error "Health check failed: ${endpoint}"
            warning "Consider rolling back deployment"
        fi
    done
    
    success "Deployment completed successfully!"
}

# Function: Run comprehensive tests with Playwright
run_tests() {
    log "Starting comprehensive test suite..."
    
    # Load testing MCPs
    claude code --mcp-config mcp.deployment.json &
    
    # Run unit tests
    log "Running unit tests..."
    npm test
    
    # Run E2E tests
    log "Running E2E tests with Playwright..."
    node tests/playwright/marketing-ui.test.js
    
    success "All tests completed"
}

# Function: Sync documentation with Context7
sync_docs() {
    log "Syncing documentation with Context7..."
    
    # Start Context7 MCP
    claude code --mcp-config mcp.development.json --command "node src/lib/ai/context7-integration.js"
    
    success "Documentation synced"
}

# Function: Check system resources (enhanced monitoring)
check_resources() {
    log "Checking system resources..."
    
    # CPU usage
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
    
    if (( $(echo "$CPU_USAGE > 50" | bc -l) )); then
        warning "High CPU usage detected: ${CPU_USAGE}%"
        warning "Consider chunking operations as per CLAUDE.md guidelines"
    else
        success "CPU usage normal: ${CPU_USAGE}%"
    fi
    
    # Memory usage
    MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
    log "Memory usage: ${MEM_USAGE}%"
    
    # Disk usage
    DISK_USAGE=$(df -h . | tail -1 | awk '{print $5}')
    log "Disk usage: ${DISK_USAGE}"
}

# Function: Clean and optimize project
clean_optimize() {
    log "Cleaning and optimizing project..."
    
    # Clear node_modules and reinstall
    rm -rf node_modules package-lock.json
    npm install
    
    # Clear Next.js cache
    rm -rf .next
    
    # Clear Claude session cache (keep history)
    find .claude-session -type f -name "*.cache" -delete
    
    # Optimize images
    if command -v imagemin &> /dev/null; then
        imagemin public/images/* --out-dir=public/images
    fi
    
    success "Project cleaned and optimized"
}

# Function: Setup OAuth testing with ESC support
oauth_test() {
    log "Starting OAuth testing environment..."
    warning "Press ESC at any time to cancel OAuth flow"
    
    # Start Playwright for OAuth testing
    claude code --mcp-config mcp.deployment.json &
    
    # Run OAuth test suite
    node tests/playwright/marketing-ui.test.js --test=testAuthenticationFlow
    
    success "OAuth testing completed"
}

# Main menu
main() {
    echo "╔══════════════════════════════════════════╗"
    echo "║     SYNTHEX Enhanced Workflow Scripts     ║"
    echo "║    Powered by Claude Code Enhancements    ║"
    echo "╚══════════════════════════════════════════╝"
    echo ""
    echo "1) Start Development Environment"
    echo "2) Marketing Workflow"
    echo "3) Safe Deploy to Production"
    echo "4) Run Comprehensive Tests"
    echo "5) Sync Documentation"
    echo "6) Check System Resources"
    echo "7) Clean & Optimize Project"
    echo "8) OAuth Testing"
    echo "9) Exit"
    echo ""
    read -p "Select option: " choice
    
    case $choice in
        1) start_dev ;;
        2) marketing_workflow ;;
        3) safe_deploy ;;
        4) run_tests ;;
        5) sync_docs ;;
        6) check_resources ;;
        7) clean_optimize ;;
        8) oauth_test ;;
        9) exit 0 ;;
        *) error "Invalid option"; main ;;
    esac
}

# Run main menu if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main
fi