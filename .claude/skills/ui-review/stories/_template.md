---
name: Story Name
url: http://localhost:3000
priority: high
---

## Preconditions
- Application running on localhost:3000
- Test user exists (use TEST_USER_EMAIL / TEST_USER_PASSWORD from .env.test)

## Steps
1. Navigate to /login
2. Enter email from TEST_USER_EMAIL
3. Enter password from TEST_USER_PASSWORD
4. Click "Sign In" button
5. Wait for page load

## Expected
- Redirect to /dashboard within 3 seconds
- Dashboard heading is visible
- No console errors
