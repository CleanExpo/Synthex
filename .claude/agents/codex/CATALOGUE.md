# Codex Agent Catalogue

> Source: https://github.com/VoltAgent/awesome-codex-subagents — 136 agents across 10 categories
> Install any agent: `node scripts/codex-agent-bridge.mjs install [name]`

## Core Development

| Agent                     | Claude Model | Permissions | Description                                                                                                              |
| ------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `api-designer`            | sonnet       | read-only   | Use when a task needs API contract design, evolution planning, or compatibility review before implementation starts.     |
| `backend-developer`       | sonnet       | read-write  | Use when a task needs scoped backend implementation or backend bug fixes after the owning path is known.                 |
| `code-mapper`             | haiku        | read-only   | Use when the parent agent needs a high-confidence map of code paths, ownership boundaries, and execution flow before cha |
| `electron-pro`            | sonnet       | read-write  | Use when a task needs Electron-specific implementation or debugging across main/renderer/preload boundaries, packaging,  |
| `frontend-developer`      | sonnet       | read-write  | Use when a task needs scoped frontend implementation or UI bug fixes with production-level behavior and quality.         |
| `fullstack-developer`     | sonnet       | read-write  | Use when one bounded feature or bug spans frontend and backend and a single worker should own the entire path.           |
| `graphql-architect`       | sonnet       | read-only   | Use when a task needs GraphQL schema evolution, resolver architecture, federation design, or distributed graph performan |
| `microservices-architect` | sonnet       | read-only   | Use when a task needs service-boundary design, inter-service contract review, or distributed-system architecture decisio |
| `mobile-developer`        | sonnet       | read-write  | Use when a task needs mobile implementation or debugging across app lifecycle, API integration, and device/platform-spec |
| `ui-designer`             | sonnet       | read-only   | Use when a task needs concrete UI decisions, interaction design, and implementation-ready design guidance before or duri |
| `ui-fixer`                | haiku        | read-write  | Use when a UI issue is already reproduced and the parent agent wants the smallest safe patch.                            |
| `websocket-engineer`      | sonnet       | read-write  | Use when a task needs real-time transport and state work across WebSocket lifecycle, message contracts, and reconnect/fa |

## Language Specialists

| Agent                         | Claude Model | Permissions | Description                                                                                                              |
| ----------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `angular-architect`           | sonnet       | read-write  | Use when a task needs Angular-specific help for component architecture, dependency injection, routing, signals, or enter |
| `cpp-pro`                     | sonnet       | read-write  | Use when a task needs C++ work involving performance-sensitive code, memory ownership, concurrency, or systems-level int |
| `csharp-developer`            | sonnet       | read-write  | Use when a task needs C# or .NET application work involving services, APIs, async flows, or application architecture.    |
| `django-developer`            | sonnet       | read-write  | Use when a task needs Django-specific work across models, views, forms, ORM behavior, or admin and middleware flows.     |
| `dotnet-core-expert`          | sonnet       | read-write  | Use when a task needs modern .NET and ASP.NET Core expertise for APIs, hosting, middleware, or cross-platform applicatio |
| `dotnet-framework-4.8-expert` | sonnet       | read-write  | Use when a task needs .NET Framework 4.8 expertise for legacy enterprise applications, compatibility constraints, or Win |
| `elixir-expert`               | sonnet       | read-write  | Use when a task needs Elixir and OTP expertise for processes, supervision, fault tolerance, or Phoenix application behav |
| `erlang-expert`               | sonnet       | read-write  | Use when a task needs Erlang/OTP and rebar3 expertise for BEAM processes, testing, releases, upgrades, or distributed ru |
| `flutter-expert`              | sonnet       | read-write  | Use when a task needs Flutter expertise for widget behavior, state management, rendering issues, or mobile cross-platfor |
| `golang-pro`                  | sonnet       | read-write  | Use when a task needs Go expertise for concurrency, service implementation, interfaces, tooling, or performance-sensitiv |
| `java-architect`              | sonnet       | read-write  | Use when a task needs Java application or service architecture help across framework boundaries, JVM behavior, or large  |
| `javascript-pro`              | sonnet       | read-write  | Use when a task needs JavaScript-focused work for runtime behavior, browser or Node execution, or application-level code |
| `kotlin-specialist`           | sonnet       | read-write  | Use when a task needs Kotlin expertise for JVM applications, Android code, coroutines, or modern strongly typed service  |
| `laravel-specialist`          | sonnet       | read-write  | Use when a task needs Laravel-specific work across routing, Eloquent, queues, validation, or application structure.      |
| `nextjs-developer`            | sonnet       | read-write  | Use when a task needs Next.js-specific work across routing, rendering modes, server actions, data fetching, or deploymen |
| `php-pro`                     | sonnet       | read-write  | Use when a task needs PHP expertise for application logic, framework integration, runtime debugging, or server-side code |
| `powershell-5.1-expert`       | sonnet       | read-write  | Use when a task needs Windows PowerShell 5.1 expertise for legacy automation, full .NET Framework interop, or Windows ad |
| `powershell-7-expert`         | sonnet       | read-write  | Use when a task needs modern PowerShell 7 expertise for cross-platform automation, scripting, or .NET-based operational  |
| `python-pro`                  | sonnet       | read-write  | Use when a task needs a Python-focused subagent for runtime behavior, packaging, typing, testing, or framework-adjacent  |
| `rails-expert`                | sonnet       | read-write  | Use when a task needs Ruby on Rails expertise for models, controllers, jobs, callbacks, or convention-driven application |
| `react-specialist`            | sonnet       | read-write  | Use when a task needs a React-focused agent for component behavior, state flow, rendering bugs, or modern React patterns |
| `rust-engineer`               | sonnet       | read-write  | Use when a task needs Rust expertise for ownership-heavy systems code, async runtime behavior, or performance-sensitive  |
| `spring-boot-engineer`        | sonnet       | read-write  | Use when a task needs Spring Boot expertise for service behavior, configuration, data access, or enterprise API implemen |
| `sql-pro`                     | sonnet       | read-only   | Use when a task needs SQL query design, query review, schema-aware debugging, or database migration analysis.            |
| `swift-expert`                | sonnet       | read-write  | Use when a task needs Swift expertise for iOS or macOS code, async flows, Apple platform APIs, or strongly typed applica |
| `typescript-pro`              | sonnet       | read-write  | Use when a task needs strong TypeScript help for types, interfaces, refactors, or compiler-driven fixes.                 |
| `vue-expert`                  | sonnet       | read-write  | Use when a task needs Vue expertise for component behavior, Composition API patterns, routing, or state and rendering is |

## Infrastructure

| Agent                       | Claude Model | Permissions | Description                                                                                                              |
| --------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `azure-infra-engineer`      | sonnet       | read-only   | Use when a task needs Azure-specific infrastructure review or implementation across resources, networking, identity, or  |
| `cloud-architect`           | sonnet       | read-only   | Use when a task needs cloud architecture review across compute, storage, networking, reliability, or multi-service desig |
| `database-administrator`    | sonnet       | read-only   | Use when a task needs operational database administration review for availability, backups, recovery, permissions, or ru |
| `deployment-engineer`       | sonnet       | read-write  | Use when a task needs deployment workflow changes, release strategy updates, or rollout and rollback safety analysis.    |
| `devops-engineer`           | sonnet       | read-write  | Use when a task needs CI, deployment pipeline, release automation, or environment configuration work.                    |
| `devops-incident-responder` | sonnet       | read-only   | Use when a task needs rapid operational triage across CI, deployments, infrastructure automation, and service delivery f |
| `docker-expert`             | haiku        | read-write  | Use when a task needs Dockerfile review, image optimization, multi-stage build fixes, or container runtime debugging.    |
| `incident-responder`        | sonnet       | read-only   | Use when a task needs broad production incident triage, containment planning, or evidence-driven root cause analysis.    |
| `kubernetes-specialist`     | sonnet       | read-only   | Use when a task needs Kubernetes manifest review, rollout safety analysis, or cluster workload debugging.                |
| `network-engineer`          | sonnet       | read-only   | Use when a task needs network-path analysis, service connectivity debugging, load-balancer review, or infrastructure net |
| `platform-engineer`         | sonnet       | read-only   | Use when a task needs internal platform, golden-path, or self-service infrastructure design for developers.              |
| `security-engineer`         | sonnet       | read-only   | Use when a task needs infrastructure and platform security engineering across IAM, secrets, network controls, or hardeni |
| `sre-engineer`              | sonnet       | read-only   | Use when a task needs reliability engineering work involving SLOs, alerting, error budgets, operational safety, or servi |
| `terraform-engineer`        | sonnet       | read-only   | Use when a task needs Terraform module design, plan review, state-aware change analysis, or IaC refactoring.             |
| `terragrunt-expert`         | haiku        | read-only   | Use when a task needs Terragrunt-specific help for module orchestration, environment layering, dependency wiring, or DRY |
| `windows-infra-admin`       | sonnet       | read-only   | Use when a task needs Windows infrastructure administration across Active Directory, DNS, DHCP, GPO, or Windows automati |

## Quality & Security

| Agent                           | Claude Model | Permissions | Description                                                                                                              |
| ------------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `accessibility-tester`          | sonnet       | read-only   | Use when a task needs an accessibility audit of UI changes, interaction flows, or component behavior.                    |
| `ad-security-reviewer`          | sonnet       | read-only   | Use when a task needs Active Directory security review across identity boundaries, delegation, GPO exposure, or director |
| `architect-reviewer`            | sonnet       | read-only   | Use when a task needs architectural review for coupling, system boundaries, long-term maintainability, or design coheren |
| `browser-debugger`              | sonnet       | read-write  | Use when a task needs browser-based reproduction, UI evidence gathering, or client-side debugging through a browser MCP  |
| `chaos-engineer`                | sonnet       | read-only   | Use when a task needs resilience analysis for dependency failure, degraded modes, recovery behavior, or controlled fault |
| `code-reviewer`                 | sonnet       | read-only   | Use when a task needs a broader code-health review covering maintainability, design clarity, and risky implementation ch |
| `compliance-auditor`            | sonnet       | read-only   | Use when a task needs compliance-oriented review of controls, auditability, policy alignment, or evidence gaps in a regu |
| `debugger`                      | sonnet       | read-only   | Use when a task needs deep bug isolation across code paths, stack traces, runtime behavior, or failing tests.            |
| `error-detective`               | haiku        | read-only   | Use when a task needs log, exception, or stack-trace analysis to identify the most probable failure source quickly.      |
| `penetration-tester`            | sonnet       | read-only   | Use when a task needs adversarial review of an application path for exploitability, abuse cases, or practical attack sur |
| `performance-engineer`          | sonnet       | read-only   | Use when a task needs performance investigation for slow requests, hot paths, rendering regressions, or scalability bott |
| `powershell-security-hardening` | sonnet       | read-only   | Use when a task needs PowerShell-focused hardening across script safety, admin automation, execution controls, or Window |
| `qa-expert`                     | sonnet       | read-only   | Use when a task needs test strategy, acceptance coverage planning, or risk-based QA guidance for a feature or release.   |
| `reviewer`                      | sonnet       | read-only   | Use when a task needs PR-style review focused on correctness, security, behavior regressions, and missing tests.         |
| `security-auditor`              | sonnet       | read-only   | Use when a task needs focused security review of code, auth flows, secrets handling, input validation, or infrastructure |
| `test-automator`                | haiku        | read-write  | Use when a task needs implementation of automated tests, test harness improvements, or targeted regression coverage.     |

## Data & AI

| Agent                       | Claude Model | Permissions | Description                                                                                                              |
| --------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `ai-engineer`               | sonnet       | read-write  | Use when a task needs implementation or debugging of model-backed application features, agent flows, or evaluation hooks |
| `data-analyst`              | haiku        | read-only   | Use when a task needs data interpretation, metric breakdown, trend explanation, or decision support from existing analyt |
| `data-engineer`             | sonnet       | read-write  | Use when a task needs ETL, ingestion, transformation, warehouse, or data-pipeline implementation and debugging.          |
| `data-scientist`            | sonnet       | read-only   | Use when a task needs statistical reasoning, experiment interpretation, feature analysis, or model-oriented data explora |
| `database-optimizer`        | sonnet       | read-only   | Use when a task needs database performance analysis for query plans, schema design, indexing, or data access patterns.   |
| `llm-architect`             | sonnet       | read-only   | Use when a task needs architecture review for prompts, tool use, retrieval, evaluation, or multi-step LLM workflows.     |
| `machine-learning-engineer` | sonnet       | read-write  | Use when a task needs ML system implementation work across training pipelines, feature flow, model serving, or inference |
| `ml-engineer`               | sonnet       | read-write  | Use when a task needs practical machine learning implementation across feature engineering, inference wiring, and model- |
| `mlops-engineer`            | sonnet       | read-write  | Use when a task needs model deployment, registry, pipeline, monitoring, or environment orchestration for machine learnin |
| `nlp-engineer`              | sonnet       | read-write  | Use when a task needs NLP-specific implementation or analysis involving text processing, embeddings, ranking, or languag |
| `postgres-pro`              | sonnet       | read-only   | Use when a task needs PostgreSQL-specific expertise for schema design, performance behavior, locking, or operational dat |
| `prompt-engineer`           | sonnet       | read-only   | Use when a task needs prompt revision, instruction design, eval-oriented prompt comparison, or prompt-output contract ti |

## Developer Experience

| Agent                         | Claude Model | Permissions | Description                                                                                                              |
| ----------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `build-engineer`              | haiku        | read-write  | Use when a task needs build-graph debugging, bundling fixes, compiler pipeline work, or CI build stabilization.          |
| `cli-developer`               | sonnet       | read-write  | Use when a task needs a command-line interface feature, UX review, argument parsing change, or shell-facing workflow imp |
| `dependency-manager`          | haiku        | read-write  | Use when a task needs dependency upgrades, package graph analysis, version-policy cleanup, or third-party library risk a |
| `documentation-engineer`      | haiku        | read-write  | Use when a task needs technical documentation that must stay faithful to current code, tooling, and operator workflows.  |
| `dx-optimizer`                | sonnet       | read-only   | Use when a task needs developer-experience improvements in setup time, local workflows, feedback loops, or day-to-day to |
| `git-workflow-manager`        | haiku        | read-only   | Use when a task needs help with branching strategy, merge flow, release branching, or repository collaboration conventio |
| `legacy-modernizer`           | sonnet       | read-only   | Use when a task needs a modernization path for older code, frameworks, or architecture without losing behavioral safety. |
| `mcp-developer`               | sonnet       | read-write  | Use when a task needs work on MCP servers, MCP clients, tool wiring, or protocol-aware integrations.                     |
| `powershell-module-architect` | sonnet       | read-write  | Use when a task needs PowerShell module structure, command design, packaging, or profile architecture work.              |
| `powershell-ui-architect`     | sonnet       | read-write  | Use when a task needs PowerShell-based UI work for terminals, forms, WPF, or admin-oriented interactive tooling.         |
| `refactoring-specialist`      | sonnet       | read-write  | Use when a task needs a low-risk structural refactor that preserves behavior while improving readability, modularity, or |
| `slack-expert`                | sonnet       | read-write  | Use when a task needs Slack platform work involving bots, interactivity, events, workflows, or Slack-specific integratio |
| `tooling-engineer`            | haiku        | read-write  | Use when a task needs internal developer tooling, scripts, automation glue, or workflow support utilities.               |

## Specialized Domains

| Agent                  | Claude Model | Permissions | Description                                                                                                              |
| ---------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `api-documenter`       | haiku        | read-write  | Use when a task needs consumer-facing API documentation generated from the real implementation, schema, and examples.    |
| `blockchain-developer` | sonnet       | read-write  | Use when a task needs blockchain or Web3 implementation and review across smart-contract integration, wallet flows, or t |
| `embedded-systems`     | sonnet       | read-write  | Use when a task needs embedded or hardware-adjacent work involving device constraints, firmware boundaries, timing, or l |
| `fintech-engineer`     | sonnet       | read-write  | Use when a task needs financial systems engineering across ledgers, reconciliation, transfers, settlement, or compliance |
| `game-developer`       | sonnet       | read-write  | Use when a task needs game-specific implementation or debugging involving gameplay systems, rendering loops, asset flow, |
| `iot-engineer`         | sonnet       | read-write  | Use when a task needs IoT system work involving devices, telemetry, edge communication, or cloud-device coordination.    |
| `m365-admin`           | sonnet       | read-only   | Use when a task needs Microsoft 365 administration help across Exchange Online, Teams, SharePoint, identity, or tenant-l |
| `mobile-app-developer` | sonnet       | read-write  | Use when a task needs app-level mobile product work across screens, state, API integration, and release-sensitive mobile |
| `payment-integration`  | sonnet       | read-write  | Use when a task needs payment-flow review or implementation for checkout, idempotency, webhooks, retries, or settlement  |
| `quant-analyst`        | sonnet       | read-only   | Use when a task needs quantitative analysis of models, strategies, simulations, or numeric decision logic.               |
| `risk-manager`         | sonnet       | read-only   | Use when a task needs explicit risk analysis for product, operational, financial, or architectural decisions.            |
| `seo-specialist`       | haiku        | read-only   | Use when a task needs search-focused technical review across crawlability, metadata, rendering, information architecture |

## Business & Product

| Agent                      | Claude Model | Permissions | Description                                                                                                              |
| -------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `business-analyst`         | sonnet       | read-only   | Use when a task needs requirements clarified, scope normalized, or acceptance criteria extracted from messy inputs befor |
| `content-marketer`         | haiku        | read-only   | Use when a task needs product-adjacent content strategy or messaging that still has to stay grounded in real technical c |
| `customer-success-manager` | haiku        | read-only   | Use when a task needs support-pattern synthesis, adoption risk analysis, or customer-facing operational guidance from en |
| `legal-advisor`            | sonnet       | read-only   | Use when a task needs legal-risk spotting in product or engineering behavior, especially around terms, data handling, or |
| `product-manager`          | sonnet       | read-only   | Use when a task needs product framing, prioritization, or feature-shaping based on engineering reality and user impact.  |
| `project-manager`          | sonnet       | read-only   | Use when a task needs dependency mapping, milestone planning, sequencing, or delivery-risk coordination across multiple  |
| `sales-engineer`           | haiku        | read-only   | Use when a task needs technically accurate solution positioning, customer-question handling, or implementation tradeoff  |
| `scrum-master`             | haiku        | read-only   | Use when a task needs process facilitation, iteration planning, or workflow friction analysis for an engineering team.   |
| `technical-writer`         | haiku        | read-write  | Use when a task needs release notes, migration notes, onboarding material, or developer-facing prose from code changes.  |
| `ux-researcher`            | sonnet       | read-only   | Use when a task needs UI feedback synthesized into actionable product and implementation guidance.                       |
| `wordpress-master`         | sonnet       | read-write  | Use when a task needs WordPress-specific implementation or debugging across themes, plugins, content architecture, or op |

## Meta-Orchestration

| Agent                     | Claude Model | Permissions | Description                                                                                                              |
| ------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `agent-installer`         | haiku        | read-only   | Use when a task needs help selecting, copying, or organizing custom agent files from this repository into Codex agent di |
| `agent-organizer`         | sonnet       | read-only   | Use when the parent agent needs help choosing subagents and dividing a larger task into clean delegated threads.         |
| `context-manager`         | haiku        | read-only   | Use when a task needs a compact project context summary that other subagents can rely on before deeper work begins.      |
| `error-coordinator`       | sonnet       | read-only   | Use when multiple errors or symptoms need to be grouped, prioritized, and assigned to the right debugging or review agen |
| `it-ops-orchestrator`     | sonnet       | read-only   | Use when a task needs coordinated operational planning across infrastructure, incident response, identity, endpoint, and |
| `knowledge-synthesizer`   | haiku        | read-only   | Use when multiple agents have returned findings and the parent agent needs a distilled, non-redundant synthesis.         |
| `multi-agent-coordinator` | sonnet       | read-only   | Use when a task needs a concrete multi-agent plan with clear role separation, dependencies, and result integration.      |
| `performance-monitor`     | haiku        | read-only   | Use when a task needs ongoing performance-signal interpretation across build, runtime, or operational metrics before dee |
| `task-distributor`        | sonnet       | read-only   | Use when a broad task needs to be broken into concrete sub-tasks with clear boundaries for multiple agents or contributo |
| `workflow-orchestrator`   | sonnet       | read-only   | Use when the parent agent needs an explicit Codex subagent workflow for a complex task with multiple stages.             |

## Research & Analysis

| Agent                 | Claude Model | Permissions | Description                                                                                                              |
| --------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| `competitive-analyst` | haiku        | read-only   | Use when a task needs a grounded comparison of tools, products, libraries, or implementation options.                    |
| `data-researcher`     | haiku        | read-only   | Use when a task needs source gathering and synthesis around datasets, metrics, data pipelines, or evidence-backed quanti |
| `docs-researcher`     | haiku        | read-only   | Use when a task needs documentation-backed verification of APIs, version-specific behavior, or framework options.        |
| `market-researcher`   | haiku        | read-only   | Use when a task needs market landscape, positioning, or demand-side research tied to a technical product or category.    |
| `research-analyst`    | sonnet       | read-only   | Use when a task needs a structured investigation of a technical topic, implementation approach, or design question.      |
| `search-specialist`   | haiku        | read-only   | Use when a task needs fast, high-signal searching of the codebase or external sources before deeper analysis begins.     |
| `trend-analyst`       | haiku        | read-only   | Use when a task needs trend synthesis across technology shifts, adoption patterns, or emerging implementation directions |

---

## Raw Agent Index (for bridge script)

```json
{
  "api-designer": {
    "path": "categories/01-core-development/api-designer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "backend-developer": {
    "path": "categories/01-core-development/backend-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "code-mapper": {
    "path": "categories/01-core-development/code-mapper.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "electron-pro": {
    "path": "categories/01-core-development/electron-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "frontend-developer": {
    "path": "categories/01-core-development/frontend-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "fullstack-developer": {
    "path": "categories/01-core-development/fullstack-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "graphql-architect": {
    "path": "categories/01-core-development/graphql-architect.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "microservices-architect": {
    "path": "categories/01-core-development/microservices-architect.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "mobile-developer": {
    "path": "categories/01-core-development/mobile-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "ui-designer": {
    "path": "categories/01-core-development/ui-designer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "ui-fixer": {
    "path": "categories/01-core-development/ui-fixer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "websocket-engineer": {
    "path": "categories/01-core-development/websocket-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "angular-architect": {
    "path": "categories/02-language-specialists/angular-architect.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "cpp-pro": {
    "path": "categories/02-language-specialists/cpp-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "csharp-developer": {
    "path": "categories/02-language-specialists/csharp-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "django-developer": {
    "path": "categories/02-language-specialists/django-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "dotnet-core-expert": {
    "path": "categories/02-language-specialists/dotnet-core-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "dotnet-framework-4.8-expert": {
    "path": "categories/02-language-specialists/dotnet-framework-4.8-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "elixir-expert": {
    "path": "categories/02-language-specialists/elixir-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "erlang-expert": {
    "path": "categories/02-language-specialists/erlang-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "flutter-expert": {
    "path": "categories/02-language-specialists/flutter-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "golang-pro": {
    "path": "categories/02-language-specialists/golang-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "java-architect": {
    "path": "categories/02-language-specialists/java-architect.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "javascript-pro": {
    "path": "categories/02-language-specialists/javascript-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "kotlin-specialist": {
    "path": "categories/02-language-specialists/kotlin-specialist.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "laravel-specialist": {
    "path": "categories/02-language-specialists/laravel-specialist.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "nextjs-developer": {
    "path": "categories/02-language-specialists/nextjs-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "php-pro": {
    "path": "categories/02-language-specialists/php-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "powershell-5.1-expert": {
    "path": "categories/02-language-specialists/powershell-5.1-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "powershell-7-expert": {
    "path": "categories/02-language-specialists/powershell-7-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "python-pro": {
    "path": "categories/02-language-specialists/python-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "rails-expert": {
    "path": "categories/02-language-specialists/rails-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "react-specialist": {
    "path": "categories/02-language-specialists/react-specialist.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "rust-engineer": {
    "path": "categories/02-language-specialists/rust-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "spring-boot-engineer": {
    "path": "categories/02-language-specialists/spring-boot-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "sql-pro": {
    "path": "categories/02-language-specialists/sql-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "swift-expert": {
    "path": "categories/02-language-specialists/swift-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "typescript-pro": {
    "path": "categories/02-language-specialists/typescript-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "vue-expert": {
    "path": "categories/02-language-specialists/vue-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "azure-infra-engineer": {
    "path": "categories/03-infrastructure/azure-infra-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "cloud-architect": {
    "path": "categories/03-infrastructure/cloud-architect.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "database-administrator": {
    "path": "categories/03-infrastructure/database-administrator.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "deployment-engineer": {
    "path": "categories/03-infrastructure/deployment-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "devops-engineer": {
    "path": "categories/03-infrastructure/devops-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "devops-incident-responder": {
    "path": "categories/03-infrastructure/devops-incident-responder.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "docker-expert": {
    "path": "categories/03-infrastructure/docker-expert.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "incident-responder": {
    "path": "categories/03-infrastructure/incident-responder.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "kubernetes-specialist": {
    "path": "categories/03-infrastructure/kubernetes-specialist.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "network-engineer": {
    "path": "categories/03-infrastructure/network-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "platform-engineer": {
    "path": "categories/03-infrastructure/platform-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "security-engineer": {
    "path": "categories/03-infrastructure/security-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "sre-engineer": {
    "path": "categories/03-infrastructure/sre-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "terraform-engineer": {
    "path": "categories/03-infrastructure/terraform-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "terragrunt-expert": {
    "path": "categories/03-infrastructure/terragrunt-expert.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "windows-infra-admin": {
    "path": "categories/03-infrastructure/windows-infra-admin.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "accessibility-tester": {
    "path": "categories/04-quality-security/accessibility-tester.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "ad-security-reviewer": {
    "path": "categories/04-quality-security/ad-security-reviewer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "architect-reviewer": {
    "path": "categories/04-quality-security/architect-reviewer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "browser-debugger": {
    "path": "categories/04-quality-security/browser-debugger.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "chaos-engineer": {
    "path": "categories/04-quality-security/chaos-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "code-reviewer": {
    "path": "categories/04-quality-security/code-reviewer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "compliance-auditor": {
    "path": "categories/04-quality-security/compliance-auditor.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "debugger": {
    "path": "categories/04-quality-security/debugger.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "error-detective": {
    "path": "categories/04-quality-security/error-detective.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "penetration-tester": {
    "path": "categories/04-quality-security/penetration-tester.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "performance-engineer": {
    "path": "categories/04-quality-security/performance-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "powershell-security-hardening": {
    "path": "categories/04-quality-security/powershell-security-hardening.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "qa-expert": {
    "path": "categories/04-quality-security/qa-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "reviewer": {
    "path": "categories/04-quality-security/reviewer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "security-auditor": {
    "path": "categories/04-quality-security/security-auditor.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "test-automator": {
    "path": "categories/04-quality-security/test-automator.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "ai-engineer": {
    "path": "categories/05-data-ai/ai-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "data-analyst": {
    "path": "categories/05-data-ai/data-analyst.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "data-engineer": {
    "path": "categories/05-data-ai/data-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "data-scientist": {
    "path": "categories/05-data-ai/data-scientist.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "database-optimizer": {
    "path": "categories/05-data-ai/database-optimizer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "llm-architect": {
    "path": "categories/05-data-ai/llm-architect.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "machine-learning-engineer": {
    "path": "categories/05-data-ai/machine-learning-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "ml-engineer": {
    "path": "categories/05-data-ai/ml-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "mlops-engineer": {
    "path": "categories/05-data-ai/mlops-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "nlp-engineer": {
    "path": "categories/05-data-ai/nlp-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "postgres-pro": {
    "path": "categories/05-data-ai/postgres-pro.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "prompt-engineer": {
    "path": "categories/05-data-ai/prompt-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "build-engineer": {
    "path": "categories/06-developer-experience/build-engineer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "cli-developer": {
    "path": "categories/06-developer-experience/cli-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "dependency-manager": {
    "path": "categories/06-developer-experience/dependency-manager.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "documentation-engineer": {
    "path": "categories/06-developer-experience/documentation-engineer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "dx-optimizer": {
    "path": "categories/06-developer-experience/dx-optimizer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "git-workflow-manager": {
    "path": "categories/06-developer-experience/git-workflow-manager.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "legacy-modernizer": {
    "path": "categories/06-developer-experience/legacy-modernizer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "mcp-developer": {
    "path": "categories/06-developer-experience/mcp-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "powershell-module-architect": {
    "path": "categories/06-developer-experience/powershell-module-architect.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "powershell-ui-architect": {
    "path": "categories/06-developer-experience/powershell-ui-architect.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "refactoring-specialist": {
    "path": "categories/06-developer-experience/refactoring-specialist.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "slack-expert": {
    "path": "categories/06-developer-experience/slack-expert.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "tooling-engineer": {
    "path": "categories/06-developer-experience/tooling-engineer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "api-documenter": {
    "path": "categories/07-specialized-domains/api-documenter.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "blockchain-developer": {
    "path": "categories/07-specialized-domains/blockchain-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "embedded-systems": {
    "path": "categories/07-specialized-domains/embedded-systems.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "fintech-engineer": {
    "path": "categories/07-specialized-domains/fintech-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "game-developer": {
    "path": "categories/07-specialized-domains/game-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "iot-engineer": {
    "path": "categories/07-specialized-domains/iot-engineer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "m365-admin": {
    "path": "categories/07-specialized-domains/m365-admin.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "mobile-app-developer": {
    "path": "categories/07-specialized-domains/mobile-app-developer.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "payment-integration": {
    "path": "categories/07-specialized-domains/payment-integration.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "quant-analyst": {
    "path": "categories/07-specialized-domains/quant-analyst.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "risk-manager": {
    "path": "categories/07-specialized-domains/risk-manager.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "seo-specialist": {
    "path": "categories/07-specialized-domains/seo-specialist.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "business-analyst": {
    "path": "categories/08-business-product/business-analyst.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "content-marketer": {
    "path": "categories/08-business-product/content-marketer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "customer-success-manager": {
    "path": "categories/08-business-product/customer-success-manager.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "legal-advisor": {
    "path": "categories/08-business-product/legal-advisor.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "product-manager": {
    "path": "categories/08-business-product/product-manager.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "project-manager": {
    "path": "categories/08-business-product/project-manager.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "sales-engineer": {
    "path": "categories/08-business-product/sales-engineer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "scrum-master": {
    "path": "categories/08-business-product/scrum-master.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "technical-writer": {
    "path": "categories/08-business-product/technical-writer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "workspace-write"
  },
  "ux-researcher": {
    "path": "categories/08-business-product/ux-researcher.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "wordpress-master": {
    "path": "categories/08-business-product/wordpress-master.toml",
    "model": "gpt-5.4",
    "sandbox": "workspace-write"
  },
  "agent-installer": {
    "path": "categories/09-meta-orchestration/agent-installer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "agent-organizer": {
    "path": "categories/09-meta-orchestration/agent-organizer.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "context-manager": {
    "path": "categories/09-meta-orchestration/context-manager.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "error-coordinator": {
    "path": "categories/09-meta-orchestration/error-coordinator.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "it-ops-orchestrator": {
    "path": "categories/09-meta-orchestration/it-ops-orchestrator.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "knowledge-synthesizer": {
    "path": "categories/09-meta-orchestration/knowledge-synthesizer.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "multi-agent-coordinator": {
    "path": "categories/09-meta-orchestration/multi-agent-coordinator.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "performance-monitor": {
    "path": "categories/09-meta-orchestration/performance-monitor.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "task-distributor": {
    "path": "categories/09-meta-orchestration/task-distributor.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "workflow-orchestrator": {
    "path": "categories/09-meta-orchestration/workflow-orchestrator.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "competitive-analyst": {
    "path": "categories/10-research-analysis/competitive-analyst.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "data-researcher": {
    "path": "categories/10-research-analysis/data-researcher.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "docs-researcher": {
    "path": "categories/10-research-analysis/docs-researcher.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "market-researcher": {
    "path": "categories/10-research-analysis/market-researcher.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "research-analyst": {
    "path": "categories/10-research-analysis/research-analyst.toml",
    "model": "gpt-5.4",
    "sandbox": "read-only"
  },
  "search-specialist": {
    "path": "categories/10-research-analysis/search-specialist.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  },
  "trend-analyst": {
    "path": "categories/10-research-analysis/trend-analyst.toml",
    "model": "gpt-5.3-codex-spark",
    "sandbox": "read-only"
  }
}
```
