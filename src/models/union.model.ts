import type { Prisma, Union } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const UnionModel = {
  findById: (id: string, args?: Omit<Prisma.UnionFindUniqueArgs, "where">) =>
    prisma.union.findUnique({ where: { id }, ...(args ?? {}) }),

  findMany: (args?: Prisma.UnionFindManyArgs) => prisma.union.findMany(args),

  create: (args: Prisma.UnionCreateArgs) => prisma.union.create(args),
};

export type UnionEntity = Union;
