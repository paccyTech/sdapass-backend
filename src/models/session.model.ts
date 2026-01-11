import type { Prisma, UmugandaSession } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const SessionModel = {
  findById: (
    id: string,
    args?: Omit<Prisma.UmugandaSessionFindUniqueArgs, "where">,
  ) => prisma.umugandaSession.findUnique({ where: { id }, ...(args ?? {}) }),

  findMany: (args?: Prisma.UmugandaSessionFindManyArgs) => prisma.umugandaSession.findMany(args),

  create: (args: Prisma.UmugandaSessionCreateArgs) => prisma.umugandaSession.create(args),

  update: (args: Prisma.UmugandaSessionUpdateArgs) => prisma.umugandaSession.update(args),

  delete: (args: Prisma.UmugandaSessionDeleteArgs) => prisma.umugandaSession.delete(args),
};

export type SessionEntity = UmugandaSession;
