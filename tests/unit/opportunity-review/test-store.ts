import type { Prisma, CommandPacket } from '@prisma/client';
import type { ProposalDatabase } from '@/lib/opportunity-review/service';
export function database(): ProposalDatabase {
  const rows = new Map<string, CommandPacket>();
  const matches = (row: CommandPacket, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (key === 'routingHints') {
        const filter = value as { path: string[]; equals: unknown };
        return (
          filter.path.reduce(
            (acc: unknown, part) => (acc as Record<string, unknown>)[part],
            row.routingHints
          ) === filter.equals
        );
      }
      return row[key as keyof CommandPacket] === value;
    });
  const commandPacket = {
    createMany: async ({ data }: { data: CommandPacket }) => {
      if (rows.has(data.id)) return { count: 0 };
      rows.set(data.id, {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return { count: 1 };
    },
    findFirst: async ({ where }: { where: Record<string, unknown> }) =>
      [...rows.values()].find(row => matches(row, where)) ?? null,
    findMany: async ({ where }: { where: Record<string, unknown> }) =>
      [...rows.values()].filter(row => matches(row, where)),
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>;
      data: Partial<CommandPacket>;
    }) => {
      const row = [...rows.values()].find(row => matches(row, where));
      if (!row) return { count: 0 };
      rows.set(row.id, { ...row, ...data, updatedAt: new Date() });
      return { count: 1 };
    },
  } as unknown as Prisma.TransactionClient['commandPacket'];
  return { commandPacket, $transaction: async fn => fn({ commandPacket }) };
}
