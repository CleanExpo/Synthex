# Synthex Video Engine Setup Script
# PowerShell script for Windows environment

param(
    [switch]$ClientMode,
    [switch]$PlatformMode,
    [string]$ClientId
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SYNTHEX VIDEO ENGINE SETUP" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python installation
Write-Host "[1/5] Checking Python installation..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  Found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python not found. Please install Python 3.10+" -ForegroundColor Red
    exit 1
}

# Check required environment variables
Write-Host "[2/5] Checking environment variables..." -ForegroundColor Yellow
$requiredVars = @(
    @{Name="GEMINI_API_KEY"; Required=$true; Description="Google Gemini API for image generation"},
    @{Name="ELEVENLABS_API_KEY"; Required=$false; Description="ElevenLabs for voice generation"},
    @{Name="OPENROUTER_API_KEY"; Required=$false; Description="OpenRouter for AI content"}
)

$missingRequired = @()
foreach ($var in $requiredVars) {
    $value = [Environment]::GetEnvironmentVariable($var.Name)
    if ($value) {
        Write-Host "  [OK] $($var.Name)" -ForegroundColor Green
    } elseif ($var.Required) {
        Write-Host "  [MISSING] $($var.Name) - $($var.Description)" -ForegroundColor Red
        $missingRequired += $var.Name
    } else {
        Write-Host "  [OPTIONAL] $($var.Name) - $($var.Description)" -ForegroundColor DarkGray
    }
}

if ($missingRequired.Count -gt 0) {
    Write-Host ""
    Write-Host "Missing required environment variables:" -ForegroundColor Red
    Write-Host "Set them in .env.local or system environment" -ForegroundColor Yellow
    exit 1
}

# Install Python dependencies
Write-Host "[3/5] Installing Python dependencies..." -ForegroundColor Yellow
$requirementsPath = "$PSScriptRoot\..\requirements.txt"
if (Test-Path $requirementsPath) {
    pip install -r $requirementsPath --quiet
    Write-Host "  Dependencies installed" -ForegroundColor Green
} else {
    # Create requirements.txt if it doesn't exist
    @"
requests>=2.31.0
Pillow>=10.0.0
moviepy>=1.0.3
"@ | Out-File -FilePath $requirementsPath -Encoding UTF8
    pip install -r $requirementsPath --quiet
    Write-Host "  Dependencies installed (created requirements.txt)" -ForegroundColor Green
}

# Create output directories
Write-Host "[4/5] Creating output directories..." -ForegroundColor Yellow
$directories = @(
    "output\platform",
    "output\clients",
    "output\temp",
    "output\assets\images",
    "output\assets\audio",
    "output\assets\video",
    "schedules"
)

foreach ($dir in $directories) {
    $fullPath = Join-Path $PSScriptRoot "..\..\..\..\..\.." $dir
    if (-not (Test-Path $fullPath)) {
        New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        Write-Host "  Created: $dir" -ForegroundColor Green
    } else {
        Write-Host "  Exists: $dir" -ForegroundColor DarkGray
    }
}

# Verify skill files
Write-Host "[5/5] Verifying skill files..." -ForegroundColor Yellow
$skillFiles = @(
    ".claude\skills\video-engine\SKILL.md",
    ".claude\skills\client-manager\SKILL.md",
    ".claude\skills\platform-showcase\SKILL.md",
    ".claude\skills\imagen-designer\SKILL.md",
    ".claude\skills\project-scanner\scripts\scan-website.py",
    ".claude\skills\imagen-designer\scripts\generate_image.py"
)

$missingSkills = @()
foreach ($skill in $skillFiles) {
    $fullPath = Join-Path $PSScriptRoot "..\..\..\..\..\.." $skill
    if (Test-Path $fullPath) {
        Write-Host "  [OK] $skill" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $skill" -ForegroundColor Red
        $missingSkills += $skill
    }
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SETUP COMPLETE" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($missingSkills.Count -eq 0) {
    Write-Host "Video Engine is ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Available modes:" -ForegroundColor Yellow
    Write-Host "  - Platform Mode: Generate Synthex marketing content"
    Write-Host "  - Client Mode: Generate videos for client businesses"
    Write-Host ""
    Write-Host "Quick commands:" -ForegroundColor Yellow
    Write-Host "  # Generate platform showcase video"
    Write-Host "  python .claude/skills/imagen-designer/scripts/generate_image.py --prompt 'Your prompt' --output output/platform/image.png"
    Write-Host ""
    Write-Host "  # Scan client website"
    Write-Host "  python .claude/skills/project-scanner/scripts/scan-website.py https://example.com"
} else {
    Write-Host "Setup completed with warnings." -ForegroundColor Yellow
    Write-Host "Some skill files are missing. Run the video-engine skill to regenerate." -ForegroundColor Yellow
}
