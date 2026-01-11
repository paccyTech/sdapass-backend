import { Prisma, type User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { UnionModel } from "@/models/union.model";
import { ForbiddenError, ConflictError } from "@/lib/errors";

export interface CreateUnionInput {
  name: string;
  description?: string | null;
}

export const listUnionsForUser = async (user: User) => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Not allowed to view unions");
  }

  return UnionModel.findMany({
    orderBy: { name: "asc" },
  });
};

export interface UnionStats {
  totalMembers: number;
  totalDistricts: number;
  totalChurches: number;
  totalPastors: number;
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
  }>;
  memberGrowth: Array<{ date: string; count: number }>;
  attendanceTrends: Array<{ month: string; attendance: number }>;
}

export const getUnionStats = async (user: User): Promise<UnionStats> => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Not allowed to view union stats");
  }

  if (!user.unionId) {
    throw new ForbiddenError("Union context is required");
  }

  const unionId = user.unionId;

  const memberWindowStart = new Date();
  memberWindowStart.setDate(memberWindowStart.getDate() - 29);

  const attendanceWindowStart = new Date();
  attendanceWindowStart.setMonth(attendanceWindowStart.getMonth() - 5);
  attendanceWindowStart.setDate(1);

  const [
    totalMembers,
    totalDistricts,
    totalChurches,
    totalPastors,
    memberSignups,
    attendanceForTrends,
    latestMembers,
    latestAttendance,
    latestChurches,
    latestDistricts,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        role: "MEMBER",
        church: {
          district: {
            unionId,
          },
        },
      },
    }),
    prisma.district.count({ where: { unionId } }),
    prisma.church.count({
      where: {
        district: {
          unionId,
        },
      },
    }),
    prisma.user.count({
      where: {
        role: "DISTRICT_ADMIN",
        district: {
          unionId,
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: "MEMBER",
        createdAt: {
          gte: memberWindowStart,
        },
        church: {
          district: {
            unionId,
          },
        },
      },
      select: { createdAt: true },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        session: {
          church: {
            district: {
              unionId,
            },
          },
          date: {
            gte: attendanceWindowStart,
          },
        },
      },
      select: {
        session: {
          select: {
            date: true,
          },
        },
      },
    }),
    prisma.user.findMany({
      where: {
        role: "MEMBER",
        church: {
          district: {
            unionId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        createdAt: true,
        church: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.attendanceRecord.findMany({
      where: {
        session: {
          church: {
            district: {
              unionId,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        session: {
          select: {
            date: true,
            church: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
    prisma.church.findMany({
      where: {
        district: {
          unionId,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        createdAt: true,
        district: {
          select: {
            name: true,
          },
        },
      },
    }),
    prisma.district.findMany({
      where: { unionId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    }),
  ]);

  const memberGrowth = (() => {
    if (memberSignups.length === 0) {
      return [];
    }

    const countsByDate = new Map<string, number>();
    for (const signup of memberSignups) {
      const key = signup.createdAt.toISOString().split("T")[0];
      countsByDate.set(key, (countsByDate.get(key) ?? 0) + 1);
    }

    const sortedDates = Array.from(countsByDate.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let runningTotal = 0;
    return sortedDates.map(([date, count]) => {
      runningTotal += count;
      return { date, count: runningTotal };
    });
  })();

  const attendanceTrends = (() => {
    if (attendanceForTrends.length === 0) {
      return [];
    }

    const countsByMonth = new Map<string, number>();
    for (const record of attendanceForTrends) {
      const sessionDate = new Date(record.session.date);
      const monthKey = `${sessionDate.getFullYear()}-${String(sessionDate.getMonth() + 1).padStart(2, "0")}`;
      countsByMonth.set(monthKey, (countsByMonth.get(monthKey) ?? 0) + 1);
    }

    return Array.from(countsByMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, count]) => ({ month: monthKey, attendance: count }));
  })();

  const recentActivity = (() => {
    const items: UnionStats["recentActivity"] = [];

    for (const member of latestMembers) {
      const name = [member.firstName, member.lastName].filter(Boolean).join(" ").trim() || "Member";
      items.push({
        id: `member-${member.id}`,
        type: "member_added",
        description: `${name} joined ${member.church?.name ?? "the union"}`,
        timestamp: member.createdAt.toISOString(),
      });
    }

    for (const attendance of latestAttendance) {
      const sessionDate = new Date(attendance.session.date);
      const formattedDate = sessionDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      items.push({
        id: `attendance-${attendance.id}`,
        type: "attendance_recorded",
        description: `Attendance recorded for ${attendance.session.church?.name ?? "a church"} (${formattedDate})`,
        timestamp: attendance.createdAt.toISOString(),
      });
    }

    for (const church of latestChurches) {
      items.push({
        id: `church-${church.id}`,
        type: "new_church",
        description: `Church ${church.name} added${church.district?.name ? ` in ${church.district.name}` : ""}`,
        timestamp: church.createdAt.toISOString(),
      });
    }

    for (const district of latestDistricts) {
      items.push({
        id: `district-${district.id}`,
        type: "new_district",
        description: `District ${district.name} registered`,
        timestamp: district.createdAt.toISOString(),
      });
    }

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  })();

  return {
    totalMembers,
    totalDistricts,
    totalChurches,
    totalPastors,
    recentActivity,
    memberGrowth,
    attendanceTrends,
  };
};

export const createUnion = async (user: User, input: CreateUnionInput) => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Not allowed to create unions");
  }

  try {
    return await UnionModel.create({
      data: {
        name: input.name,
        description: input.description ?? undefined,
      },
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("A union with this name already exists");
    }

    throw error;
  }
};
