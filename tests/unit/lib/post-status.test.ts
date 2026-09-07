import { customerPostStatus } from '@/lib/dashboard/post-status';

describe('customerPostStatus', () => {
  it('maps published to Posted', () => {
    expect(customerPostStatus('published')).toBe('Posted');
  });

  it('maps pending_approval to Ready', () => {
    expect(customerPostStatus('pending_approval')).toBe('Ready');
  });

  it('maps failed_permanently to Failed', () => {
    expect(customerPostStatus('failed_permanently')).toBe('Failed');
  });
});
