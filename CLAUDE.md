# SYNTHEX System Configuration - Claude Code

## 🚀 Project Overview
**Project:** SYNTHEX - AI-Powered Marketing Platform
**Type:** Full-stack web application with AI integration
**Status:** Production-ready with continuous development
**Latest Deployment:** https://synthex-2dnvxbd1l-unite-group.vercel.app

## 🎭 Agent Orchestra System

### Orchestra Agent (Primary Coordinator)
Coordinates all sub-agents and maintains project coherence

### Specialized Sub-Agents:
- **Architecture & Planning:** System design and optimization
- **Implementation & Testing:** Code development and quality assurance  
- **Git Operations:** Version control and commit management
- **Deployment & Production:** Vercel deployments and monitoring
- **Debug & Error Resolution:** Issue tracking and fixes

## 🔧 System Resource Management
- Monitor CPU usage with throttling at 80% capacity
- Break complex operations into smaller chunks
- Alert before resource-heavy operations
- Use incremental builds when possible

## 🌐 MCP Integration
**Active MCPs:**
- Sequential Thinking - Step-by-step problem solving
- Context7 - Enhanced context management
- Playwright - Browser automation and testing

## 📁 Session Persistence
- Session data stored in `.claude-session/`
- History logged to `.claude-session/history.log`
- Project state saved in `.claude-session/project-state.json`
- Backup checkpoints created before major changes

## 🔄 Git & Deployment Workflow

### Before Git Operations:
1. Verify current branch and status
2. Ensure all changes are saved
3. Create descriptive commit messages
4. Tag backup checkpoints for major changes

### Vercel Deployment:
1. Commit all changes first
2. Verify build configuration
3. Run `vercel --prod --yes`
4. Save deployment URLs and build IDs
5. Verify production status

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

## 🛡️ Security & Best Practices
- Comprehensive error handling
- Security-first implementation
- Inline documentation
- Long-term maintainability focus
- Anthropic-level code standards

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

## Environment Variables
Configured in Vercel dashboard - DO NOT commit .env files
