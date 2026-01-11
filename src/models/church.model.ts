import type { Church, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const ChurchModel = {
  findById: <T extends Prisma.ChurchFindUniqueArgs>(
    id: string,
    args?: Prisma.SelectSubset<T, Prisma.ChurchFindUniqueArgs>,
  ) =>
    prisma.church.findUnique({
      ...(args ?? {}),
      where: { id },
    } as Prisma.SelectSubset<T, Prisma.ChurchFindUniqueArgs>),

  findMany: (args?: Prisma.ChurchFindManyArgs) => prisma.church.findMany(args),

  create: (args: Prisma.ChurchCreateArgs) => prisma.church.create(args),

  update: (args: Prisma.ChurchUpdateArgs) => prisma.church.update(args),

  delete: (args: Prisma.ChurchDeleteArgs) => prisma.church.delete(args),

  count: (args?: Prisma.ChurchCountArgs) => prisma.church.count(args),
};

export type ChurchEntity = Church;
