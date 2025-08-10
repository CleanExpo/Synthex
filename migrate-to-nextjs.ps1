# Synthex Migration Script - Express to Next.js
# PowerShell script for Windows

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SYNTHEX PLATFORM MIGRATION TO NEXT.JS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script requires administrator privileges. Please run as administrator." -ForegroundColor Red
    exit 1
}

# Function to backup files
function Backup-Files {
    Write-Host "Creating backup..." -ForegroundColor Yellow
    $backupDir = "../synthex-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    
    if (Test-Path $backupDir) {
        Write-Host "Backup directory already exists. Removing..." -ForegroundColor Yellow
        Remove-Item -Path $backupDir -Recurse -Force
    }
    
    Copy-Item -Path "." -Destination $backupDir -Recurse -Exclude "node_modules", ".next", "dist"
    Write-Host "✓ Backup created at: $backupDir" -ForegroundColor Green
    return $backupDir
}

# Function to switch configurations
function Switch-Configurations {
    Write-Host "Switching to Next.js configuration..." -ForegroundColor Yellow
    
    # Backup current configs
    if (Test-Path "package.json") {
        Move-Item -Path "package.json" -Destination "package-express.json" -Force
    }
    if (Test-Path "tsconfig.json") {
        Move-Item -Path "tsconfig.json" -Destination "tsconfig-express.json" -Force
    }
    if (Test-Path "tailwind.config.js") {
        Move-Item -Path "tailwind.config.js" -Destination "tailwind-express.config.js" -Force
    }
    if (Test-Path "next.config.js") {
        Move-Item -Path "next.config.js" -Destination "next-express.config.js" -Force
    }
    
    # Apply Next.js configs
    if (Test-Path "package-nextjs.json") {
        Move-Item -Path "package-nextjs.json" -Destination "package.json" -Force
    }
    if (Test-Path "tsconfig-nextjs.json") {
        Move-Item -Path "tsconfig-nextjs.json" -Destination "tsconfig.json" -Force
    }
    if (Test-Path "tailwind-nextjs.config.js") {
        Move-Item -Path "tailwind-nextjs.config.js" -Destination "tailwind.config.js" -Force
    }
    if (Test-Path "next.config.mjs") {
        Move-Item -Path "next.config.mjs" -Destination "next.config.js" -Force
    }
    
    Write-Host "✓ Configuration files switched" -ForegroundColor Green
}

# Function to clean directories
function Clean-Directories {
    Write-Host "Cleaning old build artifacts..." -ForegroundColor Yellow
    
    $dirsToClean = @("dist", ".next", "build", ".cache")
    foreach ($dir in $dirsToClean) {
        if (Test-Path $dir) {
            Remove-Item -Path $dir -Recurse -Force
            Write-Host "  Removed: $dir" -ForegroundColor Gray
        }
    }
    
    Write-Host "✓ Directories cleaned" -ForegroundColor Green
}

# Function to install dependencies
function Install-Dependencies {
    Write-Host "Installing Next.js dependencies..." -ForegroundColor Yellow
    
    # Remove node_modules and package-lock.json for clean install
    if (Test-Path "node_modules") {
        Write-Host "  Removing node_modules..." -ForegroundColor Gray
        Remove-Item -Path "node_modules" -Recurse -Force
    }
    if (Test-Path "package-lock.json") {
        Remove-Item -Path "package-lock.json" -Force
    }
    
    # Install dependencies
    Write-Host "  Running npm install..." -ForegroundColor Gray
    npm install
    
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
}

# Function to create environment file
function Create-EnvFile {
    Write-Host "Creating .env.local file..." -ForegroundColor Yellow
    
    if (-not (Test-Path ".env.local")) {
        $envContent = @"
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here

# AI Services
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Social Media APIs
TWITTER_API_KEY=your_twitter_api_key
TWITTER_API_SECRET=your_twitter_api_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
TIKTOK_CLIENT_KEY=your_tiktok_client_key

# Analytics
MIXPANEL_TOKEN=your_mixpanel_token
GOOGLE_ANALYTICS_ID=your_google_analytics_id

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
"@
        $envContent | Out-File -FilePath ".env.local" -Encoding UTF8
        Write-Host "✓ .env.local created (Please update with your actual keys)" -ForegroundColor Green
    } else {
        Write-Host "✓ .env.local already exists" -ForegroundColor Green
    }
}

# Function to display next steps
function Show-NextSteps {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  MIGRATION COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Update .env.local with your actual API keys" -ForegroundColor White
    Write-Host "2. Set up Supabase project at https://supabase.com" -ForegroundColor White
    Write-Host "3. Run database migrations: npm run db:push" -ForegroundColor White
    Write-Host "4. Start development server: npm run dev" -ForegroundColor White
    Write-Host "5. Open browser to: http://localhost:3000" -ForegroundColor White
    Write-Host ""
    Write-Host "Backup Location: $backupPath" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "For help, see: SYNTHEX-IMPLEMENTATION-GUIDE.md" -ForegroundColor Gray
}

# Main execution
try {
    Write-Host "Starting migration process..." -ForegroundColor Cyan
    Write-Host ""
    
    # Step 1: Backup
    $backupPath = Backup-Files
    
    # Step 2: Switch configurations
    Switch-Configurations
    
    # Step 3: Clean directories
    Clean-Directories
    
    # Step 4: Install dependencies
    Install-Dependencies
    
    # Step 5: Create environment file
    Create-EnvFile
    
    # Step 6: Show next steps
    Show-NextSteps
    
} catch {
    Write-Host "Error during migration: $_" -ForegroundColor Red
    Write-Host "Restoring from backup..." -ForegroundColor Yellow
    
    if ($backupPath -and (Test-Path $backupPath)) {
        # Restore backup
        Copy-Item -Path "$backupPath\*" -Destination "." -Recurse -Force
        Write-Host "Backup restored. Please check the error and try again." -ForegroundColor Yellow
    }
    
    exit 1
}

# Prompt to start dev server
Write-Host "Would you like to start the development server now? (Y/N)" -ForegroundColor Cyan
$response = Read-Host
if ($response -eq 'Y' -or $response -eq 'y') {
    Write-Host "Starting Next.js development server..." -ForegroundColor Green
    npm run dev
}