# SYNTHEX System Configuration - Claude Code

## 🚀 Project Overview
**Project:** SYNTHEX - AI-Powered Marketing Platform
**Type:** Full-stack web application with AI integration
**Status:** Production-ready with continuous development
**Latest Deployment:** https://synthex-hi203jfw4-unite-group.vercel.app
**Session Initialized:** 2025-08-11

## 🎭 Agent Orchestra System

### Orchestra Agent (Primary Coordinator)
Coordinates all sub-agents and maintains project coherence. The Orchestra Agent serves as the central intelligence hub, managing task distribution, monitoring sub-agent performance, and ensuring cohesive system operation.

### Specialized Sub-Agents:
- **Code Architecture & Planning:** System design, refactoring strategies, and optimization roadmaps
- **Implementation & Testing:** Code development, test coverage, and quality assurance  
- **Git Operations & Version Control:** Commit management, branching strategies, and merge conflict resolution
- **Deployment & Production Management:** Vercel deployments, production monitoring, and rollback procedures
- **Debug & Error Resolution:** Issue tracking, root cause analysis, and systematic debugging

### Agent Collaboration Protocol:
- Each agent maintains its own context and workspace in `.claude-session/agents/`
- Agents communicate through structured handoffs to avoid redundant work
- Task distribution based on agent specialization and current workload
- Continuous performance monitoring and adaptive task reassignment

## 🔧 System Resource Management [CRITICAL - UPDATED AFTER SHUTDOWN]
- **CPU Monitoring:** STRICT throttling at 50% capacity (REDUCED from 80% after failure)
- **Memory Management:** Chunked processing for memory-intensive operations
- **Pre-execution Alerts:** Warning system for resource-heavy operations
- **Build Optimization:** Incremental builds prioritized over full rebuilds
- **Resource Allocation:** Dynamic adjustment based on system load
- **Operation Chunking:** Break tasks >10 seconds into manageable segments

## 🌐 MCP Integration
**Active MCPs (Maximum Collaboration Protocol):**
- **Sequential Thinking** - Step-by-step problem solving with hypothesis generation and verification
- **Context7** - Enhanced context management for library documentation and code examples
- **Playwright** - Browser automation, E2E testing, and visual regression testing
- **IDE Integration** - Direct VS Code integration for diagnostics and code execution

**MCP Usage Guidelines:**
- Reference MCPs in every relevant operation
- Suggest additional MCPs when tasks would benefit
- Maintain MCP activation throughout entire session
- Document MCP usage in session logs

## 📁 Session Persistence
- **Session Directory:** `.claude-session/`
  - `/history.log` - Timestamped operation log
  - `/project-state.json` - Current project state and metadata
  - `/backups/` - Checkpoint backups before major changes
  - `/agents/` - Individual agent workspaces
- **Auto-save Frequency:** Every 10 operations
- **Checkpoint Creation:** Before any major structural changes
- **Session Recovery:** Automatic state restoration on restart
- **Log Retention:** 30-day rolling window

## 🔄 Git & Deployment Workflow

### Before Git Operations:
1. **Verify Repository State:**
   - Run `git status` to check current branch and changes
   - Confirm all files are saved locally
   - Review uncommitted changes with `git diff`
2. **Create Backup Checkpoint:**
   - Tag current state: `git tag -a "backup-YYYY-MM-DD-description" -m "message"`
   - Document checkpoint in `.claude-session/history.log`
3. **Commit Strategy:**
   - Write explicit, descriptive commit messages
   - Include context about WHY changes were made
   - Reference relevant issue numbers or tasks
4. **Pre-commit Validation:**
   - Run linting and type checking
   - Execute unit tests for changed components
   - Verify no secrets or API keys in commits

### Vercel Deployment Checklist:
1. **Pre-deployment Verification:**
   - ✓ All changes committed to git
   - ✓ Build configuration verified (`vercel.json`)
   - ✓ Environment variables configured in Vercel dashboard
   - ✓ Run local build test: `npm run build`
2. **Deployment Execution:**
   - Run: `vercel --prod --yes`
   - Monitor build logs for errors
   - Document deployment URL and build ID
3. **Post-deployment Validation:**
   - Verify production URL is accessible
   - Test critical user flows
   - Check performance metrics
   - Monitor error logs for first 15 minutes
4. **Rollback Procedure:**
   - Keep previous deployment URL handy
   - Use `vercel rollback` if issues detected
   - Document rollback reason in session log

## 💻 Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript ES6+, Glassmorphic UI
- **Backend:** Node.js, Express, TypeScript
- **Database:** Prisma ORM
- **Deployment:** Vercel (Serverless)
- **AI:** OpenRouter API integration

## 📊 Recent Enhancements
- Comprehensive authentication API (auth-api.js)
- Glassmorphic modal system (modal-system.js)
- Toast notification system (toast-notifications.js)
- Form validation framework (form-validation.js)
- Theme manager with dark/light modes (theme-manager.js)
- Enhanced loading states CSS

## 🛡️ Anthropic-Level Security & Best Practices

### Security-First Implementation:
- **Never expose secrets:** All API keys and sensitive data in environment variables only
- **Input validation:** Sanitize and validate all user inputs before processing
- **SQL injection prevention:** Use parameterized queries with Prisma ORM
- **XSS protection:** Implement Content Security Policy headers
- **Rate limiting:** Enforce request limits on all API endpoints
- **Authentication:** JWT tokens with secure httpOnly cookies
- **CORS configuration:** Whitelist only trusted origins

### Code Quality Standards (Anthropic-Level):
- **Comprehensive Error Handling:**
  - Try-catch blocks for all async operations
  - Graceful degradation for non-critical failures
  - Detailed error logging without exposing sensitive data
  - User-friendly error messages
- **Edge Case Consideration:**
  - Handle network failures and timeouts
  - Account for race conditions
  - Validate data boundaries and limits
  - Test with malformed inputs
- **Documentation Standards:**
  - Inline comments for complex logic
  - JSDoc/TSDoc for all public functions
  - README updates for new features
  - API documentation maintenance
- **Long-term Maintainability:**
  - Modular, reusable components
  - Clear separation of concerns
  - Consistent naming conventions
  - Regular dependency updates
  - Technical debt tracking

### Proactive Issue Prevention:
- **Before Making Changes:**
  - Analyze potential impact on existing features
  - Consider performance implications
  - Review security ramifications
  - Plan for backward compatibility
- **System Architecture Thinking:**
  - Consider scalability from the start
  - Design for fault tolerance
  - Implement proper caching strategies
  - Plan for monitoring and observability

## 📋 Communication Protocol
- Confirm understanding before execution
- Progress updates for operations >5 seconds
- Ask for clarification when uncertain
- Summarize accomplishments at milestones

## 🔍 Known Issues & Technical Debt
- 4 npm vulnerabilities (run `npm audit` for details)
- TypeScript compilation warnings
- Need comprehensive test coverage
- Performance optimization pending

## 📝 Quick Commands
```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm test               # Run tests

# Deployment
vercel --prod --yes    # Deploy to production
vercel ls synthex      # List deployments

# Git Operations
git status            # Check current status
git tag -l           # List backup tags
```

## 🎯 Project Context & Goals
**Primary Goal:** Build a production-ready AI-powered marketing platform
**Current Phase:** Production deployment with continuous feature development
**Target Users:** Marketing teams, content creators, social media managers
**Key Differentiators:** AI-driven content optimization, multi-platform support, real-time analytics

## 📌 Important Instructions
- **DO** what has been asked; nothing more, nothing less
- **NEVER** create files unless absolutely necessary
- **ALWAYS** prefer editing existing files to creating new ones
- **NEVER** proactively create documentation files unless explicitly requested
- **ALWAYS** run lint and typecheck after code changes
- **NEVER** commit changes unless explicitly asked by the user
- **ALWAYS** use the TodoWrite tool for complex multi-step tasks

## 🔐 Environment Variables
Configured in Vercel dashboard - DO NOT commit .env files
Required variables:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `OPENROUTER_API_KEY` - OpenRouter API key for AI features
- `JWT_SECRET` - Secret for JWT token generation
- `NEXT_PUBLIC_APP_URL` - Production application URL
