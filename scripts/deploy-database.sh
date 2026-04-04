#!/bin/bash
#
# SYNTHEX Database Deployment Script (Bash version)
# Runs all SQL files in the correct order
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SUPABASE_DIR="$PROJECT_ROOT/supabase"

# Default values
MODE="check"
RESET=false
DRY_RUN=false
SKIP_SAMPLE_DATA=false
CONNECTION_STRING=""

# File definitions
STEP_FILES=(
    "schema-step1-tables.sql"
    "schema-step2-rls.sql"
    "schema-step3-advanced-features.sql"
    "schema-step4-realtime-automation.sql"
)
SAMPLE_DATA_FILE="schema-step5-sample-data-safe.sql"

# =============================================================================
# Helper Functions
# =============================================================================

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_step() { echo -e "\n${MAGENTA}🔹 $1${NC}"; }

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -m, --mode MODE      Deployment mode: migrations, steps, complete, remote, check"
    echo "  -r, --reset          Reset database before deployment (DESTRUCTIVE)"
    echo "  -d, --dry-run        Show what would be executed"
    echo "  -s, --skip-sample    Skip loading sample data"
    echo "  -c, --connection     Connection string (required for remote mode)"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -m migrations"
    echo "  $0 -m steps -r"
    echo "  $0 -m remote -c 'postgresql://user:pass@host:5432/db'"
}

# =============================================================================
# Parse Arguments
# =============================================================================

while [[ $# -gt 0 ]]; do
    case $1 in
        -m|--mode)
            MODE="$2"
            shift 2
            ;;
        -r|--reset)
            RESET=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--skip-sample)
            SKIP_SAMPLE_DATA=true
            shift
            ;;
        -c|--connection)
            CONNECTION_STRING="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# =============================================================================
# Prerequisite Checks
# =============================================================================

check_prerequisites() {
    print_step "Checking prerequisites..."

    local errors=0

    # Check Supabase CLI
    if command -v supabase &> /dev/null; then
        print_success "Supabase CLI: $(supabase --version)"
    else
        print_error "Supabase CLI not found"
        errors=$((errors + 1))
    fi

    # Check Docker (for local modes)
    if [[ "$MODE" != "remote" ]]; then
        if command -v docker &> /dev/null; then
            print_success "Docker: $(docker --version)"

            if docker info &> /dev/null; then
                print_success "Docker is running"
            else
                print_error "Docker is not running"
                errors=$((errors + 1))
            fi
        else
            print_error "Docker not found"
            errors=$((errors + 1))
        fi
    fi

    # Check psql (for remote mode)
    if [[ "$MODE" == "remote" ]]; then
        if command -v psql &> /dev/null; then
            print_success "psql: $(psql --version)"
        else
            print_error "psql not found (required for remote deployment)"
            errors=$((errors + 1))
        fi
    fi

    # Check step files exist
    local missing_files=0
    for file in "${STEP_FILES[@]}"; do
        if [[ ! -f "$SUPABASE_DIR/$file" ]]; then
            print_error "Missing: $file"
            missing_files=$((missing_files + 1))
        fi
    done

    if [[ $missing_files -eq 0 ]]; then
        print_success "All step files present (${#STEP_FILES[@]} files)"
    else
        errors=$((errors + missing_files))
    fi

    return $errors
}

# =============================================================================
# Supabase Management
# =============================================================================

start_supabase() {
    print_step "Starting Supabase local..."

    cd "$PROJECT_ROOT"

    if supabase status 2>&1 | grep -q "DB URL"; then
        print_success "Supabase is already running"
        return 0
    fi

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would run: supabase start"
        return 0
    fi

    print_info "Starting Supabase (this may take a minute)..."
    supabase start

    if [[ $? -eq 0 ]]; then
        print_success "Supabase started successfully"
        return 0
    else
        print_error "Failed to start Supabase"
        return 1
    fi
}

get_db_url() {
    cd "$PROJECT_ROOT"
    local url=$(supabase status --output json 2>/dev/null | jq -r '.DB_URL' 2>/dev/null)

    if [[ -z "$url" || "$url" == "null" ]]; then
        echo "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    else
        echo "$url"
    fi
}

# =============================================================================
# SQL Execution
# =============================================================================

execute_sql_file() {
    local file_path="$1"
    local db_url="$2"
    local file_name=$(basename "$file_path")

    if [[ ! -f "$file_path" ]]; then
        print_error "File not found: $file_path"
        return 1
    fi

    print_info "Executing: $file_name"

    if [[ "$DRY_RUN" == true ]]; then
        print_info "[DRY RUN] Would execute: $file_path"
        return 0
    fi

    if psql "$db_url" -f "$file_path" -v ON_ERROR_STOP=1 2>&1; then
        print_success "$file_name completed"
        return 0
    else
        print_error "Failed: $file_name"
        return 1
    fi
}

# =============================================================================
# Deployment Modes
# =============================================================================

deploy_with_migrations() {
    print_step "Deploying with Supabase migrations..."

    start_supabase || return 1

    cd "$PROJECT_ROOT"

    if [[ "$RESET" == true ]]; then
        print_warning "Resetting database..."
        if [[ "$DRY_RUN" != true ]]; then
            supabase db reset --no-seed || return 1
        fi
    else
        print_info "Pushing migrations..."
        if [[ "$DRY_RUN" != true ]]; then
            supabase db push || return 1
        fi
    fi

    # Load sample data
    if [[ "$SKIP_SAMPLE_DATA" != true ]]; then
        local db_url=$(get_db_url)
        local sample_path="$SUPABASE_DIR/$SAMPLE_DATA_FILE"
        if [[ -f "$sample_path" ]]; then
            print_step "Loading sample data..."
            execute_sql_file "$sample_path" "$db_url"
        fi
    fi

    return 0
}

deploy_with_steps() {
    print_step "Deploying with step-by-step schema files..."

    start_supabase || return 1

    local db_url=$(get_db_url)
    print_info "Database URL: ${db_url:0:30}..."

    if [[ "$RESET" == true ]]; then
        print_warning "Resetting database..."
        cd "$PROJECT_ROOT"
        if [[ "$DRY_RUN" != true ]]; then
            supabase db reset --no-seed
        fi
    fi

    # Execute each step file
    local step_num=1
    for file in "${STEP_FILES[@]}"; do
        print_step "Step $step_num of ${#STEP_FILES[@]}: $file"
        execute_sql_file "$SUPABASE_DIR/$file" "$db_url" || return 1
        step_num=$((step_num + 1))
    done

    # Load sample data
    if [[ "$SKIP_SAMPLE_DATA" != true ]]; then
        local sample_path="$SUPABASE_DIR/$SAMPLE_DATA_FILE"
        if [[ -f "$sample_path" ]]; then
            print_step "Step $step_num: Loading sample data..."
            execute_sql_file "$sample_path" "$db_url"
        fi
    fi

    return 0
}

deploy_remote() {
    print_step "Deploying to remote database..."

    if [[ -z "$CONNECTION_STRING" ]]; then
        print_error "Connection string required for remote deployment"
        print_info "Usage: $0 -m remote -c 'postgresql://...'"
        return 1
    fi

    print_warning "Deploying to REMOTE database. This is IRREVERSIBLE."
    read -p "Type 'DEPLOY' to confirm: " confirm

    if [[ "$confirm" != "DEPLOY" ]]; then
        print_info "Deployment cancelled"
        return 1
    fi

    local step_num=1
    for file in "${STEP_FILES[@]}"; do
        print_step "Step $step_num of ${#STEP_FILES[@]}: $file"
        execute_sql_file "$SUPABASE_DIR/$file" "$CONNECTION_STRING" || return 1
        step_num=$((step_num + 1))
    done

    return 0
}

# =============================================================================
# Main Execution
# =============================================================================

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           SYNTHEX Database Deployment Script                 ║${NC}"
echo -e "${CYAN}║                                                              ║${NC}"
printf "${CYAN}║  Mode: %-54s║${NC}\n" "$MODE"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check prerequisites
if ! check_prerequisites; then
    echo ""
    print_error "Prerequisites not met. Please fix the issues above."
    exit 1
fi

# Execute based on mode
case $MODE in
    check)
        print_success "All prerequisites passed!"
        echo ""
        print_info "Available deployment modes:"
        echo "  -m migrations  : Use Supabase migration system (recommended)"
        echo "  -m steps       : Run schema step files in order"
        echo "  -m complete    : Run single complete schema file"
        echo "  -m remote      : Deploy to remote database"
        echo ""
        print_info "Options:"
        echo "  -r, --reset         : Reset database before deployment"
        echo "  -d, --dry-run       : Show what would be executed"
        echo "  -s, --skip-sample   : Skip loading sample data"
        echo ""
        exit 0
        ;;
    migrations)
        deploy_with_migrations
        ;;
    steps)
        deploy_with_steps
        ;;
    remote)
        deploy_remote
        ;;
    *)
        print_error "Unknown mode: $MODE"
        usage
        exit 1
        ;;
esac

result=$?

echo ""
if [[ $result -eq 0 ]]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  DEPLOYMENT SUCCESSFUL                       ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"

    if [[ "$MODE" != "check" && "$MODE" != "remote" ]]; then
        echo ""
        print_info "Supabase Studio: http://127.0.0.1:54323"
        print_info "Database URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    fi

    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                   DEPLOYMENT FAILED                          ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
