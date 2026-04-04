#!/bin/bash

# Synthex Dependency Verification Functions
# Reusable functions for checking npm dependencies
# Source this file or run standalone
# Adapted from NodeJS-Starter-V1 for Synthex (npm, single-package workspace)

# ============================================================================
# Function 1: Check Lockfile Integrity
# ============================================================================
check_lockfile_integrity() {
    local lockfile="package-lock.json"
    local package_json="package.json"

    # Check existence
    if [ ! -f "$lockfile" ]; then
        echo "ERROR:MISSING:Lockfile $lockfile does not exist (run npm install)"
        return 1
    fi

    if [ ! -f "$package_json" ]; then
        echo "ERROR:MISSING:$package_json does not exist"
        return 1
    fi

    # Check JSON validity (look for lockfileVersion field)
    if ! grep -q '"lockfileVersion"' "$lockfile"; then
        echo "ERROR:INVALID:Lockfile missing lockfileVersion field"
        return 1
    fi

    # Check modification times to see if package.json is newer
    local pkg_mtime_unix lock_mtime_unix

    # Handle both macOS (stat -f) and Linux/WSL (stat -c)
    if stat -f %m "$package_json" >/dev/null 2>&1; then
        # macOS
        pkg_mtime_unix=$(stat -f %m "$package_json")
        lock_mtime_unix=$(stat -f %m "$lockfile")
    else
        # Linux / WSL
        pkg_mtime_unix=$(stat -c %Y "$package_json")
        lock_mtime_unix=$(stat -c %Y "$lockfile")
    fi

    if [ "$lock_mtime_unix" -lt "$pkg_mtime_unix" ]; then
        echo "WARN:OUTDATED:Lockfile is older than package.json (may be out of sync — run npm install)"
        return 2
    fi

    return 0
}

# ============================================================================
# Function 2: Check Dependency Synchronisation
# Verifies that declared dependencies are installed with correct versions
# ============================================================================
check_dependency_sync() {
    local workspace="${1:-.}"
    local package_json="$workspace/package.json"

    if [ ! -f "$package_json" ]; then
        echo "ERROR:NOTFOUND:package.json not found in $workspace"
        return 1
    fi

    # Use Node.js to parse package.json and verify installations
    local node_script
    node_script=$(cat << 'NODEJS_SCRIPT'
const fs = require('fs');
const path = require('path');
const workspace = process.argv[1];
const cwd = process.cwd();

try {
    const pkgPath = path.join(workspace, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const deps = {};

    // Collect all dependencies
    if (pkg.dependencies) {
        Object.assign(deps, pkg.dependencies);
    }
    if (pkg.devDependencies) {
        Object.assign(deps, pkg.devDependencies);
    }

    const issues = [];

    // Check each dependency
    for (const [name, version] of Object.entries(deps)) {
        // Skip workspace: and file: references
        if (version.startsWith('workspace:') || version.startsWith('file:')) {
            continue;
        }

        // Determine module paths to check (npm uses root node_modules)
        const localModulePath = path.join(workspace, 'node_modules', name, 'package.json');
        const rootModulePath = path.join(cwd, 'node_modules', name, 'package.json');

        let installed = false;
        let installedVersion = null;

        // Check if installed locally
        if (fs.existsSync(localModulePath)) {
            try {
                const mod = JSON.parse(fs.readFileSync(localModulePath, 'utf8'));
                installed = true;
                installedVersion = mod.version;
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Check if installed in root node_modules
        if (!installed && fs.existsSync(rootModulePath)) {
            try {
                const mod = JSON.parse(fs.readFileSync(rootModulePath, 'utf8'));
                installed = true;
                installedVersion = mod.version;
            } catch (e) {
                // Ignore parse errors
            }
        }

        // Report issues
        if (!installed) {
            issues.push(`MISSING:${name}:${version}:not_installed`);
        } else if (installedVersion) {
            // Check for major version mismatch
            const declaredClean = version.replace(/^[\^~>=<]+/, '').split('.')[0];
            const installedMajor = installedVersion.split('.')[0];

            if (declaredClean !== '*' && declaredClean !== installedMajor && !version.includes(installedVersion)) {
                issues.push(`MISMATCH:${name}:${version}:${installedVersion}`);
            }
        }
    }

    // Output results
    issues.forEach(issue => console.log(issue));
    process.exit(issues.length > 0 ? 1 : 0);
} catch (error) {
    console.error(`ERROR:${error.message}`);
    process.exit(1);
}
NODEJS_SCRIPT
)

    # Run Node.js script
    node -e "$node_script" "$workspace"
    return $?
}

# ============================================================================
# Function 3: Check for Orphaned Dependencies
# Finds packages in node_modules not declared in package.json
# ============================================================================
check_orphaned_dependencies() {
    local workspace="${1:-.}"
    local node_modules="$workspace/node_modules"

    if [ ! -d "$node_modules" ]; then
        # No node_modules directory - nothing to check
        return 0
    fi

    local package_json="$workspace/package.json"
    if [ ! -f "$package_json" ]; then
        return 1
    fi

    # Use Node.js to find orphans
    local node_script
    node_script=$(cat << 'NODEJS_SCRIPT'
const fs = require('fs');
const path = require('path');
const workspace = process.argv[1];

try {
    const pkgPath = path.join(workspace, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    const declared = {};

    // Collect declared dependencies
    if (pkg.dependencies) {
        Object.assign(declared, pkg.dependencies);
    }
    if (pkg.devDependencies) {
        Object.assign(declared, pkg.devDependencies);
    }

    const nodeModulesPath = path.join(workspace, 'node_modules');
    const entries = fs.readdirSync(nodeModulesPath, { withFileTypes: true });

    const orphans = [];

    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === '.bin' || entry.name === '.cache') {
            continue;
        }

        if (entry.isDirectory()) {
            if (entry.name.startsWith('@')) {
                // Scoped packages
                const scopePath = path.join(nodeModulesPath, entry.name);
                const scopedEntries = fs.readdirSync(scopePath, { withFileTypes: true });

                for (const scopedEntry of scopedEntries) {
                    if (scopedEntry.isDirectory() && !scopedEntry.name.startsWith('.')) {
                        const fullName = `${entry.name}/${scopedEntry.name}`;
                        if (!declared[fullName]) {
                            const pkgJsonPath = path.join(scopePath, scopedEntry.name, 'package.json');
                            if (fs.existsSync(pkgJsonPath)) {
                                try {
                                    const mod = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                                    orphans.push(`ORPHANED:${fullName}:${mod.version || 'unknown'}`);
                                } catch (e) {
                                    // Ignore
                                }
                            }
                        }
                    }
                }
            } else {
                // Regular package
                if (!declared[entry.name]) {
                    const pkgJsonPath = path.join(nodeModulesPath, entry.name, 'package.json');
                    if (fs.existsSync(pkgJsonPath)) {
                        try {
                            const mod = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
                            orphans.push(`ORPHANED:${entry.name}:${mod.version || 'unknown'}`);
                        } catch (e) {
                            // Ignore
                        }
                    }
                }
            }
        }
    }

    // Output results
    orphans.forEach(orphan => console.log(orphan));
    process.exit(orphans.length > 0 ? 1 : 0);
} catch (error) {
    console.error(`ERROR:${error.message}`);
    process.exit(1);
}
NODEJS_SCRIPT
)

    # Run Node.js script
    node -e "$node_script" "$workspace"
    return $?
}

# ============================================================================
# Function 4: Check Critical Environment Variables
# Verifies required env vars are present (reads .env.example as source of truth)
# ============================================================================
check_env_vars() {
    local env_example="${1:-.env.example}"
    local env_local=".env.local"
    local env_file=".env"

    if [ ! -f "$env_example" ]; then
        echo "WARN:MISSING:.env.example not found — cannot validate env vars"
        return 2
    fi

    # Extract required variable names from .env.example (lines with KEY=)
    local required_vars
    required_vars=$(grep -E '^[A-Z_]+=.*' "$env_example" | cut -d'=' -f1 | grep -v '^#')

    local missing=0
    local found_in=""

    while IFS= read -r var; do
        [ -z "$var" ] && continue

        # Check in process environment first
        if [ -n "${!var}" ]; then
            continue
        fi

        # Check .env.local
        if [ -f "$env_local" ] && grep -q "^${var}=" "$env_local"; then
            continue
        fi

        # Check .env
        if [ -f "$env_file" ] && grep -q "^${var}=" "$env_file"; then
            continue
        fi

        echo "MISSING_ENV:$var"
        missing=$((missing + 1))
    done <<< "$required_vars"

    return $missing
}

# ============================================================================
# Main execution (if script is run directly, not sourced)
# ============================================================================
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    echo "Synthex Dependency Verification Functions"
    echo "Source this script: source scripts/dependency-checks.sh"
    echo ""
    echo "Available functions:"
    echo "  check_lockfile_integrity()"
    echo "  check_dependency_sync [workspace]"
    echo "  check_orphaned_dependencies [workspace]"
    echo "  check_env_vars [.env.example path]"
    echo ""
    echo "Running all checks against current directory..."
    echo ""

    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'

    echo "=== Lockfile Integrity ==="
    result=$(check_lockfile_integrity)
    code=$?
    if [ $code -eq 0 ]; then
        echo -e "${GREEN}PASS${NC}: package-lock.json is valid"
    elif [ $code -eq 2 ]; then
        echo -e "${YELLOW}WARN${NC}: $result"
    else
        echo -e "${RED}FAIL${NC}: $result"
    fi

    echo ""
    echo "=== Dependency Sync ==="
    sync_output=$(check_dependency_sync ".")
    sync_code=$?
    if [ $sync_code -eq 0 ]; then
        echo -e "${GREEN}PASS${NC}: All dependencies installed"
    else
        echo -e "${RED}FAIL${NC}: Issues found:"
        echo "$sync_output"
    fi

    echo ""
    echo "=== Environment Variables ==="
    env_output=$(check_env_vars ".env.example")
    env_code=$?
    if [ $env_code -eq 0 ]; then
        echo -e "${GREEN}PASS${NC}: All required env vars present"
    else
        echo -e "${YELLOW}WARN${NC}: Missing $env_code variable(s):"
        echo "$env_output"
    fi

    exit 0
fi
