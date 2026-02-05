# =============================================================================
# SWARM BUILD SYSTEM - Multi-Agent Autonomous Development
# =============================================================================
# Based on Anthropic's multi-agent research system architecture
# Implements: Lead Agent → Specialized Subagents → Validators → Integration
# =============================================================================

function swarm_build {
    param (
        [Parameter(Mandatory=$false)]
        [string]$Task = "DISCOVER",

        [Parameter(Mandatory=$false)]
        [ValidateSet("discover", "plan", "build", "validate", "finalize")]
        [string]$Phase = "discover"
    )

    # =========================================================================
    # SYSTEM ARCHITECTURE DEFINITION
    # =========================================================================

    $SystemArchitecture = @"
<multi_agent_system>
<!--
ARCHITECTURE: Orchestrator-Worker Pattern (Anthropic Research System)
- Lead Agent coordinates and delegates
- Subagents operate in parallel with isolated contexts
- Validators verify before integration
- All agents write to shared filesystem for handoff
-->

<lead_agent role="Senior Technical Project Manager">
    <responsibilities>
        - Analyze project state and requirements
        - Decompose work into parallelizable subtasks
        - Assign work to specialized subagents with clear boundaries
        - Synthesize results and verify integration
        - Make go/no-go decisions at quality gates
    </responsibilities>
    <delegation_rules>
        - Each subagent receives: objective, output format, tool guidance, task boundaries
        - Scale effort to complexity: simple=1 agent, medium=3-5 agents, complex=10+ agents
        - Subagents output to filesystem, not through conversation (avoid telephone game)
        - Validate outputs before integration
    </delegation_rules>
</lead_agent>

<subagent_pool>
    <agent type="discovery" parallel="true">
        <role>Project Archaeologist</role>
        <tools>file_read, directory_scan, git_log, dependency_check</tools>
        <outputs>PROJECT_DISCOVERY.md, DEPENDENCY_MAP.md, TECH_STACK.md</outputs>
    </agent>

    <agent type="architect" parallel="true">
        <role>Senior System Architect</role>
        <tools>file_read, schema_analysis, api_trace</tools>
        <outputs>ARCHITECTURE.md, API_CONTRACTS.md, DATA_FLOW.md</outputs>
    </agent>

    <agent type="frontend" parallel="true">
        <role>Senior Frontend Engineer</role>
        <tools>file_edit, component_scan, style_check, test_run</tools>
        <outputs>FRONTEND_STATUS.md, component code, tests</outputs>
    </agent>

    <agent type="backend" parallel="true">
        <role>Senior Backend Engineer</role>
        <tools>file_edit, api_test, database_check, security_scan</tools>
        <outputs>BACKEND_STATUS.md, api code, tests</outputs>
    </agent>

    <agent type="integration" parallel="false">
        <role>Senior Integration Engineer</role>
        <tools>api_connect, endpoint_test, data_flow_verify</tools>
        <outputs>INTEGRATION_REPORT.md, connection code</outputs>
    </agent>

    <agent type="validator" parallel="true">
        <role>Quality Assurance Lead</role>
        <tools>test_run, lint_check, type_check, security_scan</tools>
        <outputs>VALIDATION_REPORT.md, test results</outputs>
        <rule>MUST run after every builder completes</rule>
    </agent>

    <agent type="documentation" parallel="true">
        <role>Technical Writer</role>
        <tools>file_read, file_write, markdown_lint</tools>
        <outputs>README.md, CLAUDE.md, API_DOCS.md, HANDOVER.md</outputs>
    </agent>
</subagent_pool>

<coordination_protocol>
    <rule>Subagents write outputs to /specs/ and /docs/ directories</rule>
    <rule>Lead agent reads outputs, never relies on verbal summaries</rule>
    <rule>Checkpoints created before any destructive operation</rule>
    <rule>Quality gates block progress until passed</rule>
    <rule>All decisions logged to DECISION_LOG.md</rule>
</coordination_protocol>
</multi_agent_system>
"@

    # =========================================================================
    # PHASE-SPECIFIC INSTRUCTIONS
    # =========================================================================

    $PhaseInstructions = @{
        "discover" = @"
## PHASE 1: DISCOVERY (Parallel Subagents)

You are the Lead Agent. Deploy discovery subagents to map the entire project:

### SUBAGENT TASKS (Run in Parallel):

**Subagent 1: File Structure Discovery**
- Scan all directories recursively
- Identify: source files, configs, tests, docs, assets
- Output: specs/FILE_STRUCTURE.md

**Subagent 2: Dependency Analysis**
- Parse package.json, requirements.txt, pyproject.toml, etc.
- Map all internal and external dependencies
- Identify version conflicts or missing deps
- Output: specs/DEPENDENCIES.md

**Subagent 3: Tech Stack Identification**
- Identify frameworks, languages, databases, APIs
- Document versions and compatibility
- Output: specs/TECH_STACK.md

**Subagent 4: Code Health Scan**
- Run linters, type checkers
- Identify TODO/FIXME comments
- Find dead code, unused imports
- Output: specs/CODE_HEALTH.md

**Subagent 5: Connection Audit**
- Trace all API endpoints (defined vs implemented)
- Map frontend→backend→database data flow
- Identify disconnected or stub endpoints
- Output: specs/CONNECTION_AUDIT.md

### LEAD AGENT SYNTHESIS:
After all subagents complete, create:
- specs/PROJECT_DISCOVERY_SUMMARY.md (synthesized findings)
- specs/RISK_REGISTER.md (identified risks and blockers)
- specs/PRIORITY_MATRIX.md (what to fix first)
"@

        "plan" = @"
## PHASE 2: PLANNING (Lead Agent + Architect Subagent)

Based on Discovery outputs, create the execution plan:

### READ FIRST:
- specs/PROJECT_DISCOVERY_SUMMARY.md
- specs/CONNECTION_AUDIT.md
- specs/RISK_REGISTER.md

### CREATE:
- specs/EXECUTION_PLAN.md
- specs/TASK_ASSIGNMENTS.md
- specs/DEPENDENCY_ORDER.md
"@

        "build" = @"
## PHASE 3: BUILD (Parallel Subagents with Validators)

Execute the plan with Builder→Validator pairs:

### READ FIRST:
- specs/EXECUTION_PLAN.md
- specs/TASK_ASSIGNMENTS.md

### EXECUTION PROTOCOL:
1. PRE-TASK CHECKPOINT
2. BUILDER EXECUTES
3. VALIDATOR VERIFIES
4. POST-TASK CHECKPOINT

### OUTPUT:
- specs/BUILD_LOG.md
- specs/VALIDATION_LOG.md
"@

        "validate" = @"
## PHASE 4: COMPREHENSIVE VALIDATION (Validator Subagent)

Full system validation before finalization:
- Unit Tests (≥80% coverage)
- Integration Tests
- Lint (0 errors)
- Type Check (0 errors)
- Build Verification
- Security Scan
- API Endpoint Verification
- Data Flow Verification

### OUTPUT:
- specs/VALIDATION_REPORT.md
"@

        "finalize" = @"
## PHASE 5: FINALIZATION (Documentation + Deployment)

Create handover package and deployment artifacts:
- CLAUDE.md (Updated)
- README.md (Updated)
- docs/API_DOCS.md
- docs/HANDOVER.md
- scripts/deploy.sh
- .env.example

### OUTPUT:
- specs/FINALIZATION_COMPLETE.md
"@
    }

    # =========================================================================
    # EXECUTION
    # =========================================================================

    $PhaseInstruction = $PhaseInstructions[$Phase]

    $LeadAgentPrompt = @"
$SystemArchitecture

# CURRENT PHASE: $($Phase.ToUpper())

$PhaseInstruction

# USER TASK CONTEXT:
$Task

# EXECUTION RULES:
1. You are the LEAD AGENT. Coordinate, don't do everything yourself.
2. Deploy subagents for parallelizable work.
3. ALL outputs go to filesystem (specs/, docs/, or source directories).
4. Create checkpoints before destructive operations.
5. Quality gates MUST pass before proceeding.
6. Log all decisions to specs/DECISION_LOG.md.
7. If blocked, document the blocker and stop gracefully.

# BEGIN PHASE EXECUTION
"@

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  SWARM BUILD SYSTEM - Phase: $($Phase.ToUpper())" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Task: $Task" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Deploying Lead Agent with Subagent Pool..." -ForegroundColor Green
    Write-Host ""

    # Execute
    claude -p $LeadAgentPrompt
}

# =============================================================================
# QUICK COMMANDS
# =============================================================================

function discover_project {
    swarm_build -Phase "discover" -Task "Perform complete project discovery. Map all files, dependencies, tech stack, and identify all disconnected or incomplete integrations."
}

function plan_build {
    swarm_build -Phase "plan" -Task "Based on discovery, create comprehensive execution plan with Builder→Validator task pairs."
}

function execute_build {
    swarm_build -Phase "build" -Task "Execute the plan. Build all components with validation after each task."
}

function validate_system {
    swarm_build -Phase "validate" -Task "Run comprehensive validation suite. All tests, lints, types, security, API verification."
}

function finalize_handover {
    swarm_build -Phase "finalize" -Task "Create all handover documentation, deployment scripts, and prepare for release."
}

# =============================================================================
# FULL AUTONOMOUS BUILD (All Phases)
# =============================================================================

function full_build {
    param (
        [string]$ProjectContext = "Complete autonomous build with Senior Engineer quality standards"
    )

    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host "  FULL AUTONOMOUS BUILD - All Phases" -ForegroundColor Magenta
    Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Magenta
    Write-Host ""

    $FullBuildPrompt = @"
You are the LEAD AGENT for a full autonomous build process.

EXECUTE ALL PHASES IN SEQUENCE:

## PHASE 1: DISCOVERY
Deploy discovery subagents. Map the entire project.
OUTPUT: specs/PROJECT_DISCOVERY_SUMMARY.md

## PHASE 2: PLANNING
Based on discovery, create execution plan.
OUTPUT: specs/EXECUTION_PLAN.md

## PHASE 3: BUILD
Execute plan with Builder→Validator pairs.
Checkpoint after each validated task.
OUTPUT: specs/BUILD_LOG.md, specs/VALIDATION_LOG.md

## PHASE 4: VALIDATION
Run full validation suite.
BLOCK if any check fails.
OUTPUT: specs/VALIDATION_REPORT.md

## PHASE 5: FINALIZATION
Create all documentation and deployment artifacts.
OUTPUT: CLAUDE.md, README.md, docs/*, scripts/*

CONTEXT: $ProjectContext

RULES:
- Complete each phase before moving to next
- Document everything to filesystem
- Create checkpoints at every phase boundary
- Stop gracefully if blocked, document why
- Quality gates are non-negotiable

BEGIN FULL BUILD SEQUENCE.
"@

    claude -p $FullBuildPrompt
}

# =============================================================================
# ALIASES
# =============================================================================

Set-Alias -Name discover -Value discover_project
Set-Alias -Name plan -Value plan_build
Set-Alias -Name build -Value execute_build
Set-Alias -Name validate -Value validate_system
Set-Alias -Name finalize -Value finalize_handover
Set-Alias -Name fullbuild -Value full_build

Write-Host ""
Write-Host "✅ Swarm Build System Loaded" -ForegroundColor Green
Write-Host ""
Write-Host "Commands Available:" -ForegroundColor Cyan
Write-Host "  discover    - Phase 1: Project Discovery"
Write-Host "  plan        - Phase 2: Create Execution Plan"
Write-Host "  build       - Phase 3: Execute Build"
Write-Host "  validate    - Phase 4: Comprehensive Validation"
Write-Host "  finalize    - Phase 5: Documentation & Handover"
Write-Host "  fullbuild   - All Phases Automatically"
Write-Host ""
Write-Host "Or use: swarm_build -Phase [phase] -Task '[description]'" -ForegroundColor Yellow
Write-Host ""
