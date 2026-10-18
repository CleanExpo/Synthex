import {
  shouldDeliverJourneyEvent,
  recordJourneyEvent,
  JourneyEventsNotProvisionedError,
} from '../../../../lib/client-journey/journey-events';

// NOT_PROVISIONED: client_journey_events has no Prisma model, so both helpers
// must fail loudly instead of the old "deliver anyway" / swallowed-write paths.
describe('journey-events (client_journey_events not provisioned)', () => {
  const client = { rpc: jest.fn() };

  it('shouldDeliverJourneyEvent throws FEATURE_NOT_PROVISIONED without calling the client', async () => {
    const result = shouldDeliverJourneyEvent(
      client,
      'client-123',
      'onboarding_30_day',
      'email',
      30
    );
    await expect(result).rejects.toBeInstanceOf(
      JourneyEventsNotProvisionedError
    );
    await expect(result).rejects.toMatchObject({
      code: 'FEATURE_NOT_PROVISIONED',
      table: 'client_journey_events',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('recordJourneyEvent throws FEATURE_NOT_PROVISIONED instead of dropping the write', async () => {
    const result = recordJourneyEvent(
      client,
      'client-123',
      'win_notification',
      'in_app',
      { a: 1 }
    );
    await expect(result).rejects.toMatchObject({
      name: 'JourneyEventsNotProvisionedError',
      code: 'FEATURE_NOT_PROVISIONED',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
