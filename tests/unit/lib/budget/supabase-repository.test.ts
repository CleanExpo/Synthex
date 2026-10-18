import {
  platformBudgetLedgerRepository as repo,
  BudgetLedgerNotProvisionedError,
} from '@/lib/budget/supabase-repository';
import { canCommitMonthlyBudget } from '@/lib/budget';

// NOT_PROVISIONED: location_budget_ledger has no Prisma model. An empty ledger
// would read as "nothing committed", so every method must throw instead.
describe('platformBudgetLedgerRepository (location_budget_ledger not provisioned)', () => {
  const calls: Array<[string, () => Promise<unknown>]> = [
    [
      'insert',
      () =>
        repo.insert({
          serviceAreaCoverageId: 'c',
          sourceOfTruthJobId: 'j',
          contractorId: 'k',
          postcode: '4000',
          suburb: 'Brisbane',
          monthlyAmountAud: 55,
        } as never),
    ],
    ['findActiveByCoverage', () => repo.findActiveByCoverage('c')],
    ['sumActiveMonthlyAud', () => repo.sumActiveMonthlyAud()],
    ['countActive', () => repo.countActive()],
    [
      'sumActiveMonthlyAudForContractor',
      () => repo.sumActiveMonthlyAudForContractor('k'),
    ],
    ['findByContractor', () => repo.findByContractor('k')],
    ['pause', () => repo.pause('c', 'reason')],
    ['resume', () => repo.resume('c')],
  ];

  it.each(calls)(
    '%s throws BudgetLedgerNotProvisionedError',
    async (op, call) => {
      const result = call();
      await expect(result).rejects.toBeInstanceOf(
        BudgetLedgerNotProvisionedError
      );
      await expect(result).rejects.toMatchObject({
        code: 'FEATURE_NOT_PROVISIONED',
        table: 'location_budget_ledger',
        message: expect.stringContaining(op),
      });
    }
  );

  it('the default ledger path surfaces the error rather than passing the cap check', async () => {
    await expect(canCommitMonthlyBudget(55)).rejects.toBeInstanceOf(
      BudgetLedgerNotProvisionedError
    );
  });
});
