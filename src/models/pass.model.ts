import type { Pass, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const PassModel = {
  findById: <T extends Prisma.PassFindUniqueArgs>(
    id: string,
    args?: Omit<T, "where">
  ) => prisma.pass.findUnique({ where: { id }, ...args }),

  findByToken: <T extends Prisma.PassFindUniqueArgs>(
    token: string,
    args?: Omit<T, "where">
  ) => prisma.pass.findUnique({ where: { token }, ...args }),

  findMany: (args?: Prisma.PassFindManyArgs) => prisma.pass.findMany(args),

  create: (args: Prisma.PassCreateArgs) => prisma.pass.create(args),

  update: (args: Prisma.PassUpdateArgs) => prisma.pass.update(args),

  upsert: (args: Prisma.PassUpsertArgs) => prisma.pass.upsert(args),

  delete: (id: string) => prisma.pass.delete({ where: { id } }),
};

export type PassEntity = Pass;
