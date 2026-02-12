import type { Prisma, UmugandaEvent } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const UmugandaEventModel = {
  findById: (
    id: string,
    args?: Omit<Prisma.UmugandaEventFindUniqueArgs, "where">,
  ) => prisma.umugandaEvent.findUnique({ where: { id }, ...(args ?? {}) }),

  findMany: (args?: Prisma.UmugandaEventFindManyArgs) => prisma.umugandaEvent.findMany(args),

  create: (args: Prisma.UmugandaEventCreateArgs) => prisma.umugandaEvent.create(args),

  update: (args: Prisma.UmugandaEventUpdateArgs) => prisma.umugandaEvent.update(args),

  delete: (args: Prisma.UmugandaEventDeleteArgs) => prisma.umugandaEvent.delete(args),
};

export type UmugandaEventEntity = UmugandaEvent;
