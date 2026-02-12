import type { Prisma, UmugandaEventAttendance } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const UmugandaEventAttendanceModel = {
  findById: (
    id: string,
    args?: Omit<Prisma.UmugandaEventAttendanceFindUniqueArgs, "where">,
  ) => prisma.umugandaEventAttendance.findUnique({ where: { id }, ...(args ?? {}) }),

  findMany: (args?: Prisma.UmugandaEventAttendanceFindManyArgs) =>
    prisma.umugandaEventAttendance.findMany(args),

  create: (args: Prisma.UmugandaEventAttendanceCreateArgs) =>
    prisma.umugandaEventAttendance.create(args),

  count: (args?: Prisma.UmugandaEventAttendanceCountArgs) =>
    prisma.umugandaEventAttendance.count(args),
};

export type UmugandaEventAttendanceEntity = UmugandaEventAttendance;
