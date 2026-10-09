import { pickNeedsYouItems } from '@/lib/dashboard/needs-you';

describe('pickNeedsYouItems', () => {
  it('puts failed posts first and stops at three', () => {
    const items = pickNeedsYouItems([
      { id: 'ok', content: 'Fine', status: 'scheduled' },
      {
        id: 'a1',
        content: 'Needs a look',
        status: 'draft',
        approvalStatus: 'pending',
      },
      { id: 'f1', content: 'Did not go out', status: 'failed' },
      { id: 'f2', title: 'Retry this', status: 'error' },
      { id: 'a2', content: 'Still in review', approvalStatus: 'in_review' },
    ]);

    expect(items.map(i => i.id)).toEqual(['f1', 'f2', 'a1']);
    expect(items[0].reason).toBe('failed');
    expect(items[2].reason).toBe('approval');
  });

  it('treats Ready / pending_approval as waiting, and skips empty ids', () => {
    const items = pickNeedsYouItems([
      { id: '', content: 'Ghost', status: 'failed' },
      { id: 'ready-1', content: 'Look at this', status: 'pending_approval' },
    ]);
    expect(items).toEqual([
      { id: 'ready-1', label: 'Look at this', reason: 'approval' },
    ]);
  });
});
