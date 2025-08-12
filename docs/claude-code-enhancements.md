# Claude Code Enhancement Integration Guide for SYNTHEX

## Quick Start
```bash
# Use multiple MCP configs for specialized workflows
claude code --mcp-config mcp.marketing.json mcp.development.json

# Cancel OAuth flows with ESC when testing social integrations
# Press ESC during OAuth to abort and retry with different credentials
```

## Enhanced MCP Servers for SYNTHEX

### 1. Context7 (Library Documentation)
- **Use Case**: Get latest docs for React, Next.js, Tailwind CSS
- **Command**: `mcp__context7__resolve-library-id` → `mcp__context7__get-library-docs`
- **Benefits**: Real-time documentation without leaving Claude Code

### 2. Playwright (Browser Automation)
- **Use Case**: Test marketing campaigns across browsers
- **Commands**: 
  - `mcp__playwright__browser_navigate` - Test landing pages
  - `mcp__playwright__browser_snapshot` - Capture UI states
  - `mcp__playwright__browser_take_screenshot` - Visual regression testing
- **Benefits**: Automated cross-browser testing for all campaigns

### 3. Sequential Thinking (Complex Planning)
- **Use Case**: Marketing strategy development
- **Command**: `mcp__sequential-thinking__sequentialthinking`
- **Benefits**: Hypothesis generation and verification for campaigns

### 4. IDE Integration (VS Code)
- **Commands**:
  - `mcp__ide__getDiagnostics` - Real-time error detection
  - `mcp__ide__executeCode` - Run code in Jupyter notebooks
- **Benefits**: Direct IDE feedback without context switching

## Workflow Improvements

### Marketing Content Pipeline
1. Research phase: Use Context7 for platform-specific best practices
2. Planning phase: Sequential Thinking for content strategy
3. Implementation: Direct file editing with enhanced validation
4. Testing: Playwright for visual testing across devices
5. Deployment: Safe bash execution with improved validation

### Development Workflow
1. Code with real-time diagnostics from IDE integration
2. Test with Playwright browser automation
3. Deploy with confidence using enhanced bash validation
4. Monitor with integrated logging tools

## Security Enhancements
- Reduced false positives in bash command validation
- Better handling of complex build scripts
- Safe execution of deployment commands

## Performance Optimizations
- Split configs reduce memory overhead
- Targeted MCP loading for specific tasks
- Improved spinner animations reduce perceived latency

## Troubleshooting
- Use ESC to cancel stuck OAuth flows
- Check `claude code --help` for new options
- Review `.claude-session/history.log` for MCP usage patterns