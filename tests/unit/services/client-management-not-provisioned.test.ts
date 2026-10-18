/** @jest-environment node */

/**
 * p2-u14: client-management's tables (clients, client_members,
 * scheduled_posts, user_settings) have no Prisma model, so every operation
 * throws a named NOT_PROVISIONED error instead of empty data or a dropped write.
 */

import {
  clientManagement,
  ClientWorkspaceNotProvisionedError,
} from '@/lib/services/client-management';

async function errorOf(p: Promise<unknown>) {
  return p.then(
    () => {
      throw new Error('expected a rejection');
    },
    e => e
  );
}

describe('client-management is honestly not provisioned', () => {
  it.each([
    ['getClients', () => clientManagement.getClients('org_1'), 'clients'],
    ['getClient', () => clientManagement.getClient('c1', 'u1'), 'clients'],
    [
      'createClient',
      () => clientManagement.createClient('org_1', 'u1', { name: 'Acme' }),
      'clients',
    ],
    [
      'getMembers',
      () => clientManagement.getMembers('c1', 'u1'),
      'client_members',
    ],
    [
      'inviteMember',
      () => clientManagement.inviteMember('c1', 'u1', 'a@b.test', 'editor'),
      'client_members',
    ],
    [
      'getClientAnalytics',
      () =>
        clientManagement.getClientAnalytics('c1', 'u1', {
          start: 'a',
          end: 'b',
        }),
      'scheduled_posts',
    ],
    [
      'getActiveWorkspace',
      () => clientManagement.getActiveWorkspace('u1'),
      'client_members',
    ],
    [
      'switchWorkspace',
      () => clientManagement.switchWorkspace('u1', 'c1'),
      'client_members',
    ],
  ])('%s throws FEATURE_NOT_PROVISIONED', async (_name, call, table) => {
    const err = await errorOf(call());

    expect(err).toBeInstanceOf(ClientWorkspaceNotProvisionedError);
    expect(err.code).toBe('FEATURE_NOT_PROVISIONED');
    expect(err.table).toBe(table);
    expect(err.message).toContain(table);
  });
});
