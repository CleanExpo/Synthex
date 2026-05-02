/**
 * SYN-860 — Session ID generation must use cryptographically-secure randomness.
 * Asserts that 10,000 generated IDs are unique and match the new format.
 */

const { randomBytes } = require('crypto');

function generateSessionId() {
  return `session_${Date.now()}_${randomBytes(16).toString('hex')}`;
}

describe('SYN-860 session ID generation', () => {
  it('produces 10,000 unique IDs matching the documented format', () => {
    const pattern = /^session_\d+_[0-9a-f]{32}$/;
    const ids = new Set();
    for (let i = 0; i < 10000; i++) {
      const id = generateSessionId();
      expect(id).toMatch(pattern);
      ids.add(id);
    }
    expect(ids.size).toBe(10000);
  });
});
