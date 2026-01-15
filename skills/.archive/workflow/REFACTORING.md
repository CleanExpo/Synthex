---
name: refactoring
version: 1.0.0
description: Safe refactoring patterns for code quality improvement
priority: 7
triggers:
  - refactor
  - improve code
  - clean up
  - technical debt
requires:
  - core/VERIFICATION.md
  - core/CODE_REVIEW.md
---

# Refactoring Workflow

## Purpose

Guide agents through safe refactoring to improve code quality while preserving behavior.

## Core Principle

**Refactoring changes code structure, NOT behavior.**

Tests must pass before AND after refactoring.

## Refactoring Workflow

### Phase 1: Establish Baseline

**Objective**: Ensure starting point is stable

```markdown
1. Run All Tests
   - All tests must pass
   - If tests fail, fix first
   - Document current behavior

2. Check Coverage
   - Ideally >80% coverage
   - Low coverage? Add tests first
   - Tests are your safety net

3. Document Current Behavior
   - Note what code does
   - Identify invariants
   - List constraints
```

**Baseline Checklist**:
- [ ] All tests passing
- [ ] No pending changes
- [ ] Behavior documented
- [ ] Coverage adequate
- [ ] Git committed (safe rollback point)

### Phase 2: Identify Refactoring Opportunities

**Objective**: Find what to improve

**Code Smells to Fix**:

| Smell | Indicator | Fix |
|-------|-----------|-----|
| Long Function | >50 lines | Extract functions |
| Duplicated Code | Copy-paste | Extract to shared function |
| Large Class | >300 lines | Split responsibilities |
| Long Parameter List | >5 params | Create parameter object |
| Magic Numbers | Unexplained constants | Named constants |
| Complex Conditionals | Nested if/else | Guard clauses, early returns |
| Dead Code | Unused code | Delete |

**Example Identification**:
```python
# Code smell: Long function with mixed concerns
def process_order(order_id):
    # 100 lines of code doing:
    # - Validation
    # - Payment processing
    # - Inventory update
    # - Email sending
    # - Logging
    pass

# Refactoring opportunity: Extract separate functions
```

### Phase 3: Plan Refactoring

**Objective**: Plan safe, incremental changes

```markdown
1. Choose Pattern
   - Extract Function
   - Extract Class
   - Rename Variable/Function
   - Simplify Conditional
   - Remove Duplication

2. Break Into Steps
   - Small, testable changes
   - One smell at a time
   - Keep tests passing

3. Estimate Impact
   - How many files affected?
   - Breaking changes?
   - Performance impact?
```

### Phase 4: Refactor Incrementally

**Objective**: Improve code step by step

```markdown
For each refactoring step:

  1. Make Small Change
     - One refactoring at a time
     - Keep change focused
     - Preserve behavior

  2. Run Tests
     - All tests must pass
     - If fail, revert and retry
     - No new test failures

  3. Commit
     - Commit after each successful step
     - Descriptive commit message
     - Easy to revert if needed

  4. Verify No Regressions
     - Manual testing
     - Performance check
     - No behavior changes
```

## Common Refactoring Patterns

### 1. Extract Function

**Before**:
```python
def generate_report(user_id):
    # Fetch user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")

    # Calculate metrics
    total_orders = len(user.orders)
    total_spent = sum(o.amount for o in user.orders)
    avg_order = total_spent / total_orders if total_orders > 0 else 0

    # Format report
    report = f"User: {user.name}n"
    report += f"Total Orders: {total_orders}\n"
    report += f"Total Spent: ${total_spent}\n"
    report += f"Average Order: ${avg_order}\n"

    return report
```

**After**:
```python
def generate_report(user_id):
    user = fetch_user_or_404(user_id)
    metrics = calculate_user_metrics(user)
    return format_report(user, metrics)

def fetch_user_or_404(user_id):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found")
    return user

def calculate_user_metrics(user):
    total_orders = len(user.orders)
    total_spent = sum(o.amount for o in user.orders)
    avg_order = total_spent / total_orders if total_orders > 0 else 0
    return {
        "total_orders": total_orders,
        "total_spent": total_spent,
        "avg_order": avg_order
    }

def format_report(user, metrics):
    return f"""User: {user.name}
Total Orders: {metrics['total_orders']}
Total Spent: ${metrics['total_spent']}
Average Order: ${metrics['avg_order']}"""
```

### 2. Simplify Conditional

**Before**:
```typescript
function canEdit(user: User, post: Post): boolean {
    if (user.role === 'admin') {
        return true
    } else {
        if (user.id === post.author_id) {
            if (post.status === 'draft') {
                return true
            } else {
                return false
            }
        } else {
            return false
        }
    }
}
```

**After**:
```typescript
function canEdit(user: User, post: Post): boolean {
    // Early returns for clarity
    if (user.role === 'admin') return true
    if (user.id !== post.author_id) return false
    return post.status === 'draft'
}
```

### 3. Remove Duplication

**Before**:
```python
def create_user(name, email):
    user = User(name=name, email=email)
    db.add(user)
    db.commit()
    logger.info(f"Created user: {name}")
    return user

def create_admin(name, email):
    admin = User(name=name, email=email, role='admin')
    db.add(admin)
    db.commit()
    logger.info(f"Created admin: {name}")
    return admin
```

**After**:
```python
def create_user(name, email, role='user'):
    user = User(name=name, email=email, role=role)
    db.add(user)
    db.commit()
    logger.info(f"Created {role}: {name}")
    return user

def create_admin(name, email):
    return create_user(name, email, role='admin')
```

### 4. Introduce Parameter Object

**Before**:
```typescript
function createOrder(
    userId: string,
    productId: string,
    quantity: number,
    shippingAddress: string,
    billingAddress: string,
    paymentMethod: string
): Order {
    // ...
}
```

**After**:
```typescript
interface OrderParams {
    userId: string
    productId: string
    quantity: number
    shippingAddress: string
    billingAddress: string
    paymentMethod: string
}

function createOrder(params: OrderParams): Order {
    // ...
}
```

### 5. Replace Magic Numbers

**Before**:
```python
def calculate_discount(price):
    if price > 100:
        return price * 0.1  # What's 0.1?
    elif price > 50:
        return price * 0.05  # What's 0.05?
    return 0
```

**After**:
```python
DISCOUNT_RATE_HIGH = 0.10  # 10% discount for orders >$100
DISCOUNT_RATE_LOW = 0.05   # 5% discount for orders >$50
DISCOUNT_THRESHOLD_HIGH = 100
DISCOUNT_THRESHOLD_LOW = 50

def calculate_discount(price):
    if price > DISCOUNT_THRESHOLD_HIGH:
        return price * DISCOUNT_RATE_HIGH
    elif price > DISCOUNT_THRESHOLD_LOW:
        return price * DISCOUNT_RATE_LOW
    return 0
```

## Refactoring Safety Checklist

Before starting:
- [ ] All tests passing
- [ ] Code committed
- [ ] Adequate test coverage

During refactoring:
- [ ] One change at a time
- [ ] Tests pass after each change
- [ ] Commit after each successful step
- [ ] No behavior changes

After refactoring:
- [ ] All tests still passing
- [ ] No new test failures
- [ ] Manual testing confirms behavior unchanged
- [ ] Performance not degraded
- [ ] Code coverage maintained or improved

## When to Refactor

**Good Times**:
- Before adding new feature to area
- After fixing bug (clean up related code)
- During code review
- When code becomes hard to understand
- When tests are hard to write

**Bad Times**:
- When tests are failing
- During emergency bug fix
- Right before deployment
- When requirements are unclear

## Refactoring + Feature Development

**Two-Hat Approach**:

```markdown
1. Refactoring Hat
   - Improve structure
   - No new functionality
   - Tests stay green

2. Feature Hat
   - Add new functionality
   - May add new tests
   - Build on clean base
```

**Never mix**: Refactoring + feature in same commit!

**Good Practice**:
```bash
git commit -m "refactor: Extract order validation to separate function"
git commit -m "feat: Add bulk order discount feature"
```

**Bad Practice**:
```bash
git commit -m "feat: Add discount + refactor validation + fix bug"
```

## Testing Strategy

### Before Refactoring
```python
# Characterization tests: Document current behavior
def test_current_order_processing_behavior():
    """Baseline test: Current behavior before refactoring."""
    result = process_order(test_order)
    # Assert current behavior (even if not ideal)
    assert result == expected_current_behavior
```

### After Refactoring
```python
# Same test, should still pass
def test_order_processing_behavior():
    """After refactoring: Behavior must be identical."""
    result = process_order(test_order)
    # Same assertion, should still pass
    assert result == expected_current_behavior
```

## Rollback Strategy

If refactoring goes wrong:

```bash
# Revert last commit
git revert HEAD

# Or reset to before refactoring
git reset --hard <commit-before-refactoring>
```

Always commit before starting refactoring!

## Documentation

After refactoring:
- Update comments if needed
- Update docstrings if interface changed
- Add comments explaining complex logic
- Store pattern to memory

## Integration with Memory

```python
async def refactor_code(agent, target):
    # Check for past refactorings
    patterns = await agent.memory.get_successful_patterns(
        pattern_type="refactoring"
    )

    # Apply learned patterns
    for pattern in patterns:
        if pattern.applies_to(target):
            await agent.apply_refactoring_pattern(pattern)

    # Store new pattern
    await agent.memory.store_pattern(
        pattern_type="refactoring",
        pattern_data={
            "target": target,
            "refactoring_type": "extract_function",
            "improvements": ["readability", "testability"],
            "before_metrics": before,
            "after_metrics": after
        }
    )
```

---

**Goal**: Improve code quality systematically while maintaining reliability through comprehensive testing.
