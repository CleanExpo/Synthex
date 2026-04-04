# ============================================================================
# Ralph Wiggum Technique - Autonomous Task Completion Loop (Windows)
# ============================================================================
# Usage:
#   .\scripts\ralph.ps1 -Init                # Initialise .planning/phases/ directory
#   .\scripts\ralph.ps1 [-MaxIterations 50]  # Run the loop
#
# Based on: Matt Pocock / Jeffrey Huntley technique
# Adapted for Synthex (npm, .planning/phases/ structure, Windows 11)
# ============================================================================

param(
    [switch]$Init,
    [switch]$Help,
    [int]$MaxIterations = 50,
    [switch]$RunBuild,
    [switch]$RunE2E,
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

# Configuration - paths relative to project root
$PlansDir = ".\.planning\phases"
$PrdFile = "$PlansDir\prd.json"
$ProgressFile = "$PlansDir\progress.txt"
$PromptFile = "$PlansDir\ralph-prompt.md"

# Statistics
$script:startTime = Get-Date
$script:iterationCount = 0
$script:tasksCompleted = 0

# ============================================================================
# Helper Functions
# ============================================================================

function Write-Header {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  Ralph Wiggum Technique" -ForegroundColor Cyan
    Write-Host "  Autonomous Task Completion Loop" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host ""
}

function Write-Phase {
    param([string]$Message)
    Write-Host ""
    Write-Host ">>> $Message" -ForegroundColor Magenta
}

function Write-Success {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Green
}

function Write-WarningMsg {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Red
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor Blue
}

function Write-Iteration {
    param([int]$Number, [string]$TaskId, [string]$Title)
    Write-Host ""
    Write-Host ([char]0x2501 * 60) -ForegroundColor Cyan
    Write-Host "  Iteration $Number`: $TaskId" -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ([char]0x2501 * 60) -ForegroundColor Cyan
}

# ============================================================================
# Initialisation Function
# ============================================================================

function Initialize-Ralph {
    Write-Header
    Write-Phase "Initialising Ralph Wiggum for Synthex..."

    # Create .planning/phases directory
    if (-not (Test-Path $PlansDir)) {
        New-Item -ItemType Directory -Path $PlansDir -Force | Out-Null
        Write-Success "Created $PlansDir directory"
    } else {
        Write-Info "Directory $PlansDir already exists"
    }

    # Create PRD template
    if (-not (Test-Path $PrdFile)) {
        $prdTemplate = @'
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "project": "Synthex",
  "version": "1.0.0",
  "created_at": "2026-01-07T00:00:00Z",
  "last_updated": "2026-01-07T00:00:00Z",

  "user_stories": [
    {
      "id": "US-001",
      "epic": "Setup",
      "title": "Example: Initial feature setup",
      "description": "As a developer, I want the feature implemented so I can deliver value",
      "priority": "critical",
      "acceptance_criteria": [
        "npm run dev starts without errors",
        "All tests pass",
        "No TypeScript errors"
      ],
      "verification": {
        "type_check": true,
        "lint": true,
        "unit_tests": true,
        "e2e_tests": false,
        "build": true
      },
      "passes": false,
      "last_attempt": null,
      "attempt_count": 0,
      "notes": "",
      "depends_on": []
    }
  ],

  "metadata": {
    "total_stories": 1,
    "passing_stories": 0,
    "current_focus": null,
    "max_attempts_per_task": 3
  }
}
'@
        $prdTemplate | Set-Content $PrdFile -Encoding UTF8
        Write-Success "Created $PrdFile template"
    } else {
        Write-Info "File $PrdFile already exists"
    }

    # Create progress file
    if (-not (Test-Path $ProgressFile)) {
        $projectName = Split-Path -Leaf (Get-Location)
        $timestamp = Get-Date -Format "o"
        $progressTemplate = @"
# Ralph Wiggum Progress Log
# Project: $projectName
# Created: $timestamp

This file tracks learnings across iterations. Each session appends here.
The LLM reads this at the start of each iteration for context.

---

"@
        $progressTemplate | Set-Content $ProgressFile -Encoding UTF8
        Write-Success "Created $ProgressFile"
    } else {
        Write-Info "File $ProgressFile already exists"
    }

    # Create prompt template
    if (-not (Test-Path $PromptFile)) {
        $promptTemplate = @'
# Ralph Wiggum Iteration {{ITERATION}}

## Current Task: {{TASK_ID}}

You are working on user story **{{TASK_ID}}** as part of the Ralph Wiggum autonomous development loop for Synthex.

## Your Context Files

1. **PRD (Task List)**: `.planning/phases/prd.json`
   - Contains all user stories with acceptance criteria
   - Check the `passes` flag - only work on tasks where `passes: false`

2. **Progress Log**: `.planning/phases/progress.txt`
   - Contains learnings from previous iterations
   - Read this for context about what has been tried

## Your Mission

1. **Read the PRD** - Find task {{TASK_ID}} and understand:
   - Acceptance criteria (what success looks like)
   - Dependencies (what must be done first)
   - Previous attempts (check attempt_count)

2. **Check Progress Log** - Look for:
   - Relevant learnings from past iterations
   - Issues encountered on similar tasks
   - Patterns that worked

3. **Implement the Task**
   - Write code to satisfy ALL acceptance criteria
   - Follow project conventions (check CLAUDE.md)
   - Add or update tests as needed
   - Handle edge cases

4. **Verify Before Claiming Complete**
   Run these commands and ensure ALL pass:
   ```powershell
   npm run type-check  # TypeScript must compile
   npm run lint        # No lint errors
   npm test            # All tests pass
   npm run build       # Build succeeds
   ```

5. **Update Progress Log**
   Append a session entry to `.planning/phases/progress.txt`:
   ```markdown
   ---

   ## Session {{ITERATION}}: [timestamp]
   **Task**: {{TASK_ID}} - [title]
   **Status**: [COMPLETED | IN_PROGRESS | BLOCKED]

   ### Work Done
   - [List changes made]

   ### Issues Encountered
   - [Any problems found]

   ### Learnings
   - [Knowledge for future iterations]

   ### Next Steps
   1. [If incomplete, what to do next]
   ```

## Critical Rules

1. **Never claim success without verification** - Run the actual commands
2. **One task at a time** - Focus only on {{TASK_ID}}
3. **Be honest about failures** - Record them in progress.txt
4. **Small, incremental changes** - Easier to verify and debug
5. **Commit on success** - Use conventional commit format

## Output Format

After completing work, report:

```
## Iteration {{ITERATION}} Complete

### Task: {{TASK_ID}}
### Status: [PASS | FAIL]

### Verification Results
- Type Check: [PASS/FAIL]
- Lint: [PASS/FAIL]
- Tests: [PASS/FAIL]
- Build: [PASS/FAIL]
- E2E: [PASS/FAIL/SKIPPED]

### Changes Made
- [Files modified]

### If FAIL - What Needs Fixing
- [Root cause]
- [Suggested fix for next iteration]
```
'@
        $promptTemplate | Set-Content $PromptFile -Encoding UTF8
        Write-Success "Created $PromptFile"
    } else {
        Write-Info "File $PromptFile already exists"
    }

    Write-Host ""
    Write-Success "Ralph Wiggum initialised successfully!"
    Write-Host ""
    Write-Info "Next steps:"
    Write-Host "  1. Edit .planning\phases\prd.json with your user stories"
    Write-Host "  2. Run: .\scripts\ralph.ps1 -MaxIterations 50"
    Write-Host ""
}

# ============================================================================
# Prerequisite Checks
# ============================================================================

function Test-Prerequisites {
    Write-Phase "Checking prerequisites..."

    $missing = $false

    # Check Claude CLI
    try {
        Get-Command claude -ErrorAction Stop | Out-Null
        Write-Success "Claude CLI found"
    } catch {
        Write-ErrorMsg "Claude CLI not found"
        Write-Info "Install with: npm install -g @anthropic-ai/claude-code"
        $missing = $true
    }

    # Check PRD file
    if (-not (Test-Path $PrdFile)) {
        Write-ErrorMsg "PRD file not found at $PrdFile"
        Write-Info "Run: .\scripts\ralph.ps1 -Init"
        $missing = $true
    } else {
        Write-Success "PRD file found"
    }

    # Check/create progress file
    if (-not (Test-Path $ProgressFile)) {
        Write-WarningMsg "Progress file not found, creating..."
        "# Ralph Wiggum Progress Log`n" | Set-Content $ProgressFile -Encoding UTF8
    }

    if ($missing) {
        Write-ErrorMsg "Prerequisites not met. Exiting."
        exit 1
    }

    Write-Success "All prerequisites OK"
}

# ============================================================================
# Task Management Functions
# ============================================================================

function Get-NextTask {
    $prd = Get-Content $PrdFile -Raw | ConvertFrom-Json

    $priorityOrder = @{
        "critical" = 0
        "high"     = 1
        "medium"   = 2
        "low"      = 3
    }

    # Get IDs of passing tasks
    $passingIds = $prd.user_stories | Where-Object { $_.passes -eq $true } | ForEach-Object { $_.id }

    # Filter to unpassed tasks where dependencies are met
    $available = $prd.user_stories | Where-Object {
        $_.passes -eq $false -and
        (($_.depends_on -eq $null) -or ($_.depends_on.Count -eq 0) -or
         (($_.depends_on | Where-Object { $passingIds -notcontains $_ }).Count -eq 0))
    }

    # Sort by priority and return first
    $sorted = $available | Sort-Object { $priorityOrder[$_.priority] }

    if ($sorted) {
        return $sorted[0].id
    }
    return $null
}

function Test-AllPassed {
    $prd = Get-Content $PrdFile -Raw | ConvertFrom-Json
    $failing = $prd.user_stories | Where-Object { $_.passes -eq $false }
    return ($failing.Count -eq 0)
}

function Get-TaskTitle {
    param([string]$TaskId)
    $prd = Get-Content $PrdFile -Raw | ConvertFrom-Json
    $task = $prd.user_stories | Where-Object { $_.id -eq $TaskId }
    return $task.title
}

# ============================================================================
# Verification Pipeline
# ============================================================================

function Invoke-Verification {
    Write-Phase "Running verification pipeline..."

    $failed = $false

    # Type check
    Write-Info "  Running type check..."
    npm run type-check 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "  Type check: PASS"
    } else {
        Write-ErrorMsg "  Type check: FAIL"
        $failed = $true
    }

    # Lint
    Write-Info "  Running lint..."
    npm run lint 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "  Lint: PASS"
    } else {
        Write-ErrorMsg "  Lint: FAIL"
        $failed = $true
    }

    # Tests
    Write-Info "  Running tests..."
    npm test 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "  Tests: PASS"
    } else {
        Write-ErrorMsg "  Tests: FAIL"
        $failed = $true
    }

    # Build (opt-in via -RunBuild flag)
    if ($RunBuild) {
        Write-Info "  Running build..."
        npm run build 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  Build: PASS"
        } else {
            Write-ErrorMsg "  Build: FAIL"
            $failed = $true
        }
    } else {
        Write-WarningMsg "  Build: SKIPPED (pass -RunBuild to enable)"
    }

    # E2E tests (only if previous passed and -RunE2E flag set)
    if (-not $failed -and $RunE2E) {
        Write-Info "  Running E2E tests..."
        npm run e2e 2>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  E2E: PASS"
        } else {
            Write-ErrorMsg "  E2E: FAIL"
            $failed = $true
        }
    } else {
        Write-WarningMsg "  E2E: SKIPPED (pass -RunE2E to enable)"
    }

    return -not $failed
}

# ============================================================================
# Iteration Execution
# ============================================================================

function Invoke-Iteration {
    param([int]$Iteration, [string]$TaskId)

    $taskTitle = Get-TaskTitle -TaskId $TaskId
    Write-Iteration -Number $Iteration -TaskId $TaskId -Title $taskTitle

    # Build prompt with substitutions
    $prompt = Get-Content $PromptFile -Raw
    $prompt = $prompt -replace '\{\{ITERATION\}\}', $Iteration
    $prompt = $prompt -replace '\{\{TASK_ID\}\}', $TaskId

    # Run Claude Code with context
    Write-Phase "Invoking Claude Code..."

    # Create temp prompt file
    $tempPrompt = [System.IO.Path]::GetTempFileName() + ".md"
    $prompt | Set-Content $tempPrompt -Encoding UTF8

    # Run Claude with PRD and progress as context
    try {
        claude --print (Get-Content $tempPrompt -Raw) `
            --add-file $PrdFile `
            --add-file $ProgressFile
    } catch {
        Write-WarningMsg "Claude execution completed with notes"
    }

    Remove-Item $tempPrompt -ErrorAction SilentlyContinue

    # Run verification
    if (Invoke-Verification) {
        Write-Success "Verification passed! Marking $TaskId as complete."

        # Update PRD
        $prd = Get-Content $PrdFile -Raw | ConvertFrom-Json
        $timestamp = Get-Date -Format "o"

        foreach ($story in $prd.user_stories) {
            if ($story.id -eq $TaskId) {
                $story.passes = $true
                $story.last_attempt = $timestamp
            }
        }
        $prd.metadata.passing_stories = ($prd.user_stories | Where-Object { $_.passes -eq $true }).Count
        $prd.last_updated = $timestamp
        $prd | ConvertTo-Json -Depth 10 | Set-Content $PrdFile -Encoding UTF8

        # Commit (stage individual files, never git add -A)
        git add $PrdFile $ProgressFile 2>&1 | Out-Null
        $commitMsg = "feat($TaskId): $taskTitle`n`nRalph Wiggum: Iteration $Iteration complete`n`nCo-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
        git commit -m $commitMsg 2>&1 | Out-Null

        $script:tasksCompleted++
        return $true
    } else {
        Write-WarningMsg "Verification failed. Recording attempt."

        # Update attempt count
        $prd = Get-Content $PrdFile -Raw | ConvertFrom-Json
        $timestamp = Get-Date -Format "o"

        foreach ($story in $prd.user_stories) {
            if ($story.id -eq $TaskId) {
                $story.attempt_count++
                $story.last_attempt = $timestamp
            }
        }
        $prd | ConvertTo-Json -Depth 10 | Set-Content $PrdFile -Encoding UTF8

        return $false
    }
}

# ============================================================================
# Summary Report
# ============================================================================

function Show-Summary {
    $executionTime = (Get-Date) - $script:startTime
    $prd = Get-Content $PrdFile -Raw | ConvertFrom-Json

    $passing = $prd.metadata.passing_stories
    $total = if ($prd.metadata.total_stories) { $prd.metadata.total_stories } else { $prd.user_stories.Count }

    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  Summary" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  Iterations:       $($script:iterationCount)" -ForegroundColor White
    Write-Host "  Tasks Completed: " -NoNewline
    Write-Host $script:tasksCompleted -ForegroundColor Green
    Write-Host "  Progress:        " -NoNewline
    Write-Host "$passing" -ForegroundColor Green -NoNewline
    Write-Host "/$total tasks" -ForegroundColor White
    Write-Host "  Duration:         $($executionTime.ToString('hh\:mm\:ss'))" -ForegroundColor White
    Write-Host ""
}

# ============================================================================
# Main Entry Point
# ============================================================================

function Main {
    # Handle -Help
    if ($Help) {
        Write-Host "Ralph Wiggum Technique - Autonomous Task Completion (Synthex)"
        Write-Host ""
        Write-Host "Usage:"
        Write-Host "  .\scripts\ralph.ps1 -Init                  Initialise .planning/phases/ directory"
        Write-Host "  .\scripts\ralph.ps1 [-MaxIterations N]     Run the loop (default: 50)"
        Write-Host "  .\scripts\ralph.ps1 -Help                  Show this help"
        Write-Host ""
        Write-Host "Flags:"
        Write-Host "  -RunBuild    Enable build step in verification"
        Write-Host "  -RunE2E      Enable E2E tests in verification"
        Write-Host "  -Verbose     Show detailed output"
        Write-Host ""
        return
    }

    # Handle -Init
    if ($Init) {
        Initialize-Ralph
        return
    }

    Write-Header
    Test-Prerequisites

    for ($i = 1; $i -le $MaxIterations; $i++) {
        $script:iterationCount = $i

        # Check if all done
        if (Test-AllPassed) {
            Write-Host ""
            Write-Success "All tasks complete! Project finished in $i iterations."
            Show-Summary
            return
        }

        # Get next task
        $taskId = Get-NextTask

        if (-not $taskId) {
            Write-WarningMsg "No available tasks (may be blocked by dependencies)."
            break
        }

        # Run iteration
        Invoke-Iteration -Iteration $i -TaskId $taskId

        # Small delay
        Start-Sleep -Seconds 2
    }

    Write-Host ""
    Write-WarningMsg "Reached max iterations ($MaxIterations). Some tasks may remain."
    Show-Summary
}

Main
