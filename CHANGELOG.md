# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Support for Claude 4.6 adaptive thinking in OpenRouter provider
- New fields in StepExecution model: retryMetadata, thinkingEffort, tokensUsed
- AI provider abstraction usage in ai-generate step
- Enhanced AI step result types with structured metadata

### Changed
- OpenRouter provider now properly forwards thinking, thinkingDisplay, and cache parameters
- Updated ai-generate step to use AI provider abstraction instead of direct fetch calls
- Updated workflow orchestrator to handle new metadata fields in StepExecution

## [0.1.0] - 2025-01-01

### Added
- Initial project structure and core workflow engine components
- AI content generation and evaluation capabilities
- Basic workflow orchestration system

[Unreleased]: https://github.com/your-org/synthex/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/synthex/releases/tag/v0.1.0