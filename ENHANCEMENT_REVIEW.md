# AI Content Generation Enhancement Review

## auto-approve (already applied this run)

- [x] **OpenRouter thinking passthrough for Claude 4.6 models** - Enhanced OpenRouter provider to properly handle `thinking`, `thinkingDisplay`, and `cache` parameters for Claude 4.6 models
- [x] **StepExecution model enhancement for structured metadata** - Added `retryMetadata`, `thinkingEffort`, and `tokensUsed` fields to improve observability and debugging
- [x] **AI generate step refactored to use provider abstraction** - Updated `ai-generate` step to use the proper AI provider interface instead of direct fetch calls

## need-sign-off (higher-risk: skills/config/structural/security — NOT applied)

- [ ] **Zod validation hardening for AI generation API surface** - Implement comprehensive Zod validation across all AI generation endpoints and interfaces
- [ ] **Confidence score display + threshold badges in AIContentStudio** - UI enhancements for displaying and managing confidence thresholds
- [ ] **Isolated context refactor in ai-plan step** - Apply the same provider abstraction refactoring to the ai-plan step type

## more-context (loop cannot decide alone)

- [ ] **Additional AI provider mappings for thinking efforts** - Determine if other providers (Google, OpenAI) need analogous thinking effort support
- [ ] **Token usage tracking granularity** - Decide if per-step token tracking should be extended beyond basic counts
- [ ] **Retry metadata schema design** - Define detailed structure for retry metadata to support advanced debugging capabilities