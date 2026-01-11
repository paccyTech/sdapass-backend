import type { District, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const DistrictModel = {
  findById: (id: string, args?: Omit<Prisma.DistrictFindUniqueArgs, "where">) =>
    prisma.district.findUnique({ where: { id }, ...args }),

  findMany: (args?: Prisma.DistrictFindManyArgs) => prisma.district.findMany(args),

  create: (args: Prisma.DistrictCreateArgs) => prisma.district.create(args),

  update: (args: Prisma.DistrictUpdateArgs) => prisma.district.update(args),

  delete: (args: Prisma.DistrictDeleteArgs) => prisma.district.delete(args),

  count: (args?: Prisma.DistrictCountArgs) => prisma.district.count(args),
};

export type DistrictEntity = District;
