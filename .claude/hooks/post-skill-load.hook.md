---
name: post-skill-load
type: hook
trigger: After skill loaded
priority: 3
blocking: false
version: 1.0.0
---

# Post-Skill-Load Hook

Runs after a skill is loaded to load dependencies.

## Actions

### 1. Load Dependent Skills
```yaml
# If skill has `requires:` in frontmatter
requires:
  - core/VERIFICATION.md

# Load each required skill
```

### 2. Check Australian Context Requirements
```
IF skill.category == "australian" OR skill.auto_load == true:
  Load australian-context.skill.md
```

### 3. Load Related Data Files
```yaml
# If skill has `data_source:` in frontmatter
data_source: .claude/data/trusted-sources.yaml

# Load data file
```

## Integration

Called automatically by skill loading system.
