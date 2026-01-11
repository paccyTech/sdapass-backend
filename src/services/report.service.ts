import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildAttendanceWhereForUser,
  type AttendanceFilters,
} from "@/services/attendance.service";
import { ForbiddenError } from "@/lib/errors";

export interface AttendanceSummaryFilters extends AttendanceFilters {
  fromDate?: string | null;
  toDate?: string | null;
}

const parseDate = (value: string | null | undefined): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ForbiddenError(`Invalid date value: ${value}`);
  }

  return date;
};

const applyRoleScopedFilters = (user: User, filters: AttendanceSummaryFilters) => {
  if (user.role === "UNION_ADMIN") {
    return filters;
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId) {
      throw new ForbiddenError("No district assigned to this account");
    }

    if (filters.districtId && filters.districtId !== user.districtId) {
      throw new ForbiddenError("Cannot view reports outside your district");
    }

    return {
      ...filters,
      districtId: user.districtId,
    } satisfies AttendanceSummaryFilters;
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId) {
      throw new ForbiddenError("No church assigned to this account");
    }

    if (filters.churchId && filters.churchId !== user.churchId) {
      throw new ForbiddenError("Cannot view reports outside your church");
    }

    return {
      ...filters,
      churchId: user.churchId,
      districtId: user.districtId ?? filters.districtId,
    } satisfies AttendanceSummaryFilters;
  }

  throw new ForbiddenError("Not allowed to view reports");
};

const buildWhereForReports = (
  user: User,
  filters: AttendanceSummaryFilters,
): Prisma.AttendanceRecordWhereInput => {
  const where = buildAttendanceWhereForUser(user, filters);

  const from = parseDate(filters.fromDate);
  const to = parseDate(filters.toDate);

  if (from || to) {
    const createdAtFilter: Prisma.DateTimeFilter = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };

    where.createdAt = createdAtFilter;
  }

  return where;
};

export const getAttendanceSummaryForUser = async (
  user: User,
  filters: AttendanceSummaryFilters = {},
) => {
  const scoped = applyRoleScopedFilters(user, filters);
  const where = buildWhereForReports(user, scoped);

  const [total, approved] = await Promise.all([
    prisma.attendanceRecord.count({ where }),
    prisma.attendanceRecord.count({
      where: {
        ...where,
        status: "APPROVED",
      },
    }),
  ]);

  const pending = total - approved;

  return {
    total,
    approved,
    pending,
  };
};

export const getAttendanceBreakdownByChurch = async (
  user: User,
  filters: AttendanceSummaryFilters = {},
) => {
  const scoped = applyRoleScopedFilters(user, filters);
  const where = buildWhereForReports(user, scoped);

  const rows = await prisma.attendanceRecord.groupBy({
    where,
    by: ["sessionId"],
    _count: { _all: true },
  });

  if (!rows.length) {
    return [] as const;
  }

  const sessionIds = rows.map((row) => row.sessionId);
  const sessions = await prisma.umugandaSession.findMany({
    where: { id: { in: sessionIds } },
    select: {
      id: true,
      church: {
        select: {
          id: true,
          name: true,
          districtId: true,
        },
      },
    },
  });

  const sessionMap = new Map(sessions.map((session) => [session.id, session.church]));

  const breakdown = new Map<
    string,
    {
      churchId: string;
      churchName: string;
      districtId: string | null;
      attendanceCount: number;
    }
  >();

  for (const row of rows) {
    const church = sessionMap.get(row.sessionId);
    const churchId = church?.id ?? "unknown";
    const current = breakdown.get(churchId);
    const count = row._count._all;

    if (current) {
      current.attendanceCount += count;
    } else {
      breakdown.set(churchId, {
        churchId,
        churchName: church?.name ?? "Unknown Church",
        districtId: church?.districtId ?? null,
        attendanceCount: count,
      });
    }
  }

  return Array.from(breakdown.values());
};

export const getAttendanceBreakdownByDistrict = async (
  user: User,
  filters: AttendanceSummaryFilters = {},
) => {
  const scoped = applyRoleScopedFilters(user, filters);
  const where = buildWhereForReports(user, scoped);

  const rows = await prisma.attendanceRecord.groupBy({
    where,
    by: ["sessionId"],
    _count: { _all: true },
  });

  if (!rows.length) {
    return [] as const;
  }

  const sessionIds = rows.map((row) => row.sessionId);
  const sessions = await prisma.umugandaSession.findMany({
    where: { id: { in: sessionIds } },
    select: {
      id: true,
      church: {
        select: {
          district: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  const sessionDistrictMap = new Map(
    sessions.map((session) => [session.id, session.church?.district]),
  );

  const breakdown = new Map<
    string,
    {
      districtId: string;
      districtName: string;
      attendanceCount: number;
    }
  >();

  for (const row of rows) {
    const district = sessionDistrictMap.get(row.sessionId);
    const districtId = district?.id ?? "unknown";
    const current = breakdown.get(districtId);
    const count = row._count._all;

    if (current) {
      current.attendanceCount += count;
    } else {
      breakdown.set(districtId, {
        districtId,
        districtName: district?.name ?? "Unknown District",
        attendanceCount: count,
      });
    }
  }

  return Array.from(breakdown.values());
};
