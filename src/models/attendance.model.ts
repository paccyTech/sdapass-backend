import type { AttendanceRecord, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const AttendanceModel = {
  findById: (
    id: string,
    args?: Omit<Prisma.AttendanceRecordFindUniqueArgs, "where">,
  ) =>
    prisma.attendanceRecord.findUnique({
      ...(args ?? {}),
      where: { id },
    }),

  findMany: (args?: Prisma.AttendanceRecordFindManyArgs) =>
    prisma.attendanceRecord.findMany(args),

  create: (args: Prisma.AttendanceRecordCreateArgs) => prisma.attendanceRecord.create(args),

  update: (args: Prisma.AttendanceRecordUpdateArgs) => prisma.attendanceRecord.update(args),

  delete: (id: string) => prisma.attendanceRecord.delete({ where: { id } }),

  aggregate: (args: Prisma.AttendanceRecordAggregateArgs) => prisma.attendanceRecord.aggregate(args),

  groupBy: prisma.attendanceRecord.groupBy.bind(prisma.attendanceRecord),

  count: (args?: Prisma.AttendanceRecordCountArgs) => prisma.attendanceRecord.count(args),
};

export type AttendanceEntity = AttendanceRecord;
