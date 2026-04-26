import { AttendanceStatus, Prisma, type User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { UmugandaEventModel } from "@/models/umugandaEvent.model";
import { UmugandaEventAttendanceModel } from "@/models/umugandaEventAttendance.model";

const getDayRange = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const ensureSessionForChurchOnDate = async (
  churchId: string,
  date: Date,
  createdById: string,
  theme?: string | null,
) => {
  const { start, end } = getDayRange(date);

  const existing = await prisma.umugandaSession.findFirst({
    where: {
      churchId,
      date: {
        gte: start,
        lt: end,
      },
    },
    select: { id: true },
    orderBy: { date: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.umugandaSession.create({
    data: {
      churchId,
      date: start,
      theme: theme ?? null,
      createdById,
    },
    select: { id: true },
  });
};

const upsertAttendanceForEventCheckIn = async (
  memberId: string,
  churchId: string,
  eventDate: Date,
  checkedInById: string,
  eventTheme?: string | null,
) => {
  const session = await ensureSessionForChurchOnDate(churchId, eventDate, checkedInById, eventTheme);

  return prisma.attendanceRecord.upsert({
    where: {
      sessionId_memberId: {
        sessionId: session.id,
        memberId,
      },
    },
    update: {
      status: AttendanceStatus.APPROVED,
      approvedById: checkedInById,
    },
    create: {
      sessionId: session.id,
      memberId,
      status: AttendanceStatus.APPROVED,
      approvedById: checkedInById,
    },
    select: { id: true },
  });
};

const eventInclude = {
  union: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  _count: {
    select: {
      attendance: true,
    },
  },
} satisfies Prisma.UmugandaEventInclude;

export interface CreateUmugandaEventInput {
  date: Date;
  theme?: string | null;
  location?: string | null;
}

export interface UpdateUmugandaEventInput {
  date?: Date;
  theme?: string | null;
  location?: string | null;
}

const resolveUnionIdForUser = async (user: User): Promise<string> => {
  if (user.role === "UNION_ADMIN") {
    if (!user.unionId) {
      throw new ForbiddenError("No union assigned to this account");
    }
    return user.unionId;
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId) {
      throw new ForbiddenError("No district assigned to this account");
    }

    const district = await prisma.district.findUnique({
      where: { id: user.districtId },
      select: { unionId: true },
    });

    const unionId = district?.unionId;
    if (!unionId) {
      throw new ForbiddenError("Unable to resolve union for this district");
    }

    return unionId;
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId) {
      throw new ForbiddenError("No church assigned to this account");
    }

    const church = await prisma.church.findUnique({
      where: { id: user.churchId },
      select: {
        district: {
          select: {
            unionId: true,
          },
        },
      },
    });

    const unionId = church?.district.unionId;
    if (!unionId) {
      throw new ForbiddenError("Unable to resolve union for this church");
    }

    return unionId;
  }

  throw new ForbiddenError("Not allowed to access Umuganda events");
};

export const listUmugandaEventsForUser = async (user: User) => {
  if (user.role === "UNION_ADMIN") {
    if (!user.unionId) {
      throw new ForbiddenError("No union assigned to this account");
    }

    return UmugandaEventModel.findMany({
      where: { unionId: user.unionId },
      include: eventInclude,
      orderBy: { date: "desc" },
    });
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId) {
      throw new ForbiddenError("No church assigned to this account");
    }

    const church = await prisma.church.findUnique({
      where: { id: user.churchId },
      select: {
        district: {
          select: {
            unionId: true,
          },
        },
      },
    });

    const unionId = church?.district.unionId;
    if (!unionId) {
      throw new ForbiddenError("Unable to resolve union for this church");
    }

    return UmugandaEventModel.findMany({
      where: { unionId },
      include: eventInclude,
      orderBy: { date: "desc" },
    });
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId) {
      throw new ForbiddenError("No district assigned to this account");
    }

    const district = await prisma.district.findUnique({
      where: { id: user.districtId },
      select: { unionId: true },
    });

    const unionId = district?.unionId;
    if (!unionId) {
      throw new ForbiddenError("Unable to resolve union for this district");
    }

    return UmugandaEventModel.findMany({
      where: { unionId },
      include: eventInclude,
      orderBy: { date: "desc" },
    });
  }

  throw new ForbiddenError("Not allowed to view Umuganda events");
};

export const createUmugandaEvent = async (user: User, input: CreateUmugandaEventInput) => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Only union admins can create Umuganda events");
  }

  if (!user.unionId) {
    throw new ForbiddenError("No union assigned to this account");
  }

  return UmugandaEventModel.create({
    data: {
      unionId: user.unionId,
      date: input.date,
      theme: input.theme ?? null,
      location: input.location ?? null,
      createdById: user.id,
    },
    include: eventInclude,
  });
};

export const getUmugandaEventForUser = async (user: User, eventId: string) => {
  const unionId = await resolveUnionIdForUser(user);

  const event = await UmugandaEventModel.findById(eventId, {
    include: eventInclude,
  });

  if (!event) {
    throw new NotFoundError("Umuganda event not found");
  }

  if (event.unionId !== unionId) {
    throw new ForbiddenError("Cannot access an event outside your union");
  }

  return event;
};

export const updateUmugandaEvent = async (
  user: User,
  eventId: string,
  input: UpdateUmugandaEventInput,
) => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Only union admins can update Umuganda events");
  }

  if (!user.unionId) {
    throw new ForbiddenError("No union assigned to this account");
  }

  const event = await UmugandaEventModel.findById(eventId, {
    select: { id: true, unionId: true },
  });

  if (!event) {
    throw new NotFoundError("Umuganda event not found");
  }

  if (event.unionId !== user.unionId) {
    throw new ForbiddenError("Cannot update an event outside your union");
  }

  return UmugandaEventModel.update({
    where: { id: event.id },
    data: {
      date: input.date,
      theme: input.theme,
      location: input.location,
    },
    include: eventInclude,
  });
};

export const deleteUmugandaEvent = async (user: User, eventId: string) => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Only union admins can delete Umuganda events");
  }

  if (!user.unionId) {
    throw new ForbiddenError("No union assigned to this account");
  }

  const event = await UmugandaEventModel.findById(eventId, {
    select: { id: true, unionId: true },
  });

  if (!event) {
    throw new NotFoundError("Umuganda event not found");
  }

  if (event.unionId !== user.unionId) {
    throw new ForbiddenError("Cannot delete an event outside your union");
  }

  await UmugandaEventModel.delete({ where: { id: event.id } });
  return { success: true as const };
};

export const listUmugandaEventAttendanceForUser = async (
  user: User,
  eventId: string,
  params?: { churchId?: string },
) => {
  const unionId = await resolveUnionIdForUser(user);

  const event = await UmugandaEventModel.findById(eventId, {
    select: { id: true, unionId: true },
  });

  if (!event) {
    throw new NotFoundError("Umuganda event not found");
  }

  if (event.unionId !== unionId) {
    throw new ForbiddenError("Cannot access an event outside your union");
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId) {
      throw new ForbiddenError("No church assigned to this account");
    }

    return UmugandaEventAttendanceModel.findMany({
      where: { eventId: event.id, churchId: user.churchId },
      orderBy: { checkedInAt: "desc" },
      include: {
        member: {
          select: { id: true, firstName: true, lastName: true, nationalId: true },
        },
        church: {
          select: { id: true, name: true },
        },
      },
    });
  }

  return UmugandaEventAttendanceModel.findMany({
    where: {
      eventId: event.id,
      churchId: params?.churchId,
    },
    orderBy: { checkedInAt: "desc" },
    include: {
      member: {
        select: { id: true, firstName: true, lastName: true, nationalId: true },
      },
      church: {
        select: { id: true, name: true },
      },
    },
  });
};

const resolveMemberIdFromToken = async (token: string): Promise<string> => {
  const pass = await prisma.pass.findUnique({
    where: { token },
    select: { memberId: true },
  });

  if (pass?.memberId) {
    return pass.memberId;
  }

  const memberPass = await prisma.memberPass.findUnique({
    where: { token },
    select: { memberId: true },
  });

  if (memberPass?.memberId) {
    return memberPass.memberId;
  }

  throw new NotFoundError("Member QR token not found");
};

export interface CheckInToUmugandaEventInput {
  eventId: string;
  token: string;
}

export interface UmugandaEventFilters {
  search?: string;
  churchIds?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  attendanceMin?: number;
  attendanceMax?: number;
  theme?: string;
  location?: string;
  eventStatus?: 'all' | 'upcoming' | 'past';
}

export const listFilteredUmugandaEventsForUser = async (
  user: User,
  filters: UmugandaEventFilters = {}
) => {
  const unionId = await resolveUnionIdForUser(user);
  
  const where: any = { unionId };

  // Search filter
  if (filters.search) {
    where.OR = [
      { theme: { contains: filters.search, mode: 'insensitive' } },
      { location: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) {
      where.date.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      where.date.lte = filters.dateTo;
    }
  }

  // Theme filter
  if (filters.theme) {
    where.theme = { contains: filters.theme, mode: 'insensitive' };
  }

  // Location filter
  if (filters.location) {
    where.location = { contains: filters.location, mode: 'insensitive' };
  }

  // Event status filter
  const now = new Date();
  if (filters.eventStatus === 'upcoming') {
    where.date = { ...where.date, gte: now };
  } else if (filters.eventStatus === 'past') {
    where.date = { ...where.date, lt: now };
  }

  const events = await UmugandaEventModel.findMany({
    where,
    include: {
      ...eventInclude,
      attendance: {
        include: {
          church: {
            select: { id: true, name: true },
          },
        },
      },
    },
    orderBy: { date: 'desc' },
  });

  // Apply attendance filter and church filter after query (since they're based on attendance data)
  let filteredEvents = events;

  // Attendance filter
  if (filters.attendanceMin !== undefined || filters.attendanceMax !== undefined) {
    filteredEvents = filteredEvents.filter((event: any) => {
      const attendance = (event as any)._count?.attendance || 0;
      if (filters.attendanceMin !== undefined && attendance < filters.attendanceMin) {
        return false;
      }
      if (filters.attendanceMax !== undefined && attendance > filters.attendanceMax) {
        return false;
      }
      return true;
    });
  }

  // Church filter
  if (filters.churchIds && filters.churchIds.length > 0) {
    filteredEvents = filteredEvents.filter((event: any) => {
      if (!event.attendance || event.attendance.length === 0) {
        return false;
      }
      return event.attendance.some((att: any) => filters.churchIds!.includes(att.churchId));
    });
  }

  return filteredEvents;
};

export const checkInToUmugandaEvent = async (user: User, input: CheckInToUmugandaEventInput) => {
  if (user.role !== "CHURCH_ADMIN") {
    throw new ForbiddenError("Only church admins can record event attendance");
  }

  if (!user.churchId) {
    throw new ForbiddenError("No church assigned to this account");
  }

  const event = await UmugandaEventModel.findById(input.eventId, {
    select: { id: true, unionId: true, date: true, theme: true, location: true },
  });

  if (!event) {
    throw new NotFoundError("Umuganda event not found");
  }

  const church = await prisma.church.findUnique({
    where: { id: user.churchId },
    select: {
      id: true,
      district: {
        select: {
          unionId: true,
        },
      },
    },
  });

  const unionId = church?.district.unionId;
  if (!unionId) {
    throw new ForbiddenError("Unable to resolve union for this church");
  }

  if (event.unionId !== unionId) {
    throw new ForbiddenError("Cannot check in members for an event outside your union");
  }

  const memberId = await resolveMemberIdFromToken(input.token);

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      role: true,
      churchId: true,
      firstName: true,
      lastName: true,
      nationalId: true,
    },
  });

  if (!member || member.role !== "MEMBER") {
    throw new NotFoundError("Member not found");
  }

  if (member.churchId !== user.churchId) {
    throw new ForbiddenError("Member belongs to another church");
  }

  try {
    const attendance = await UmugandaEventAttendanceModel.create({
      data: {
        eventId: event.id,
        memberId: member.id,
        churchId: user.churchId,
      },
      include: {
        event: {
          select: {
            id: true,
            date: true,
            theme: true,
          },
        },
        member: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            nationalId: true,
          },
        },
        church: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await upsertAttendanceForEventCheckIn(
      member.id,
      user.churchId,
      event.date,
      user.id,
      event.theme,
    );

    return attendance;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const existing = await UmugandaEventAttendanceModel.findMany({
        where: {
          eventId: event.id,
          memberId: member.id,
        },
        include: {
          event: {
            select: {
              id: true,
              date: true,
              theme: true,
            },
          },
          member: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              nationalId: true,
            },
          },
          church: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        take: 1,
      });

      await upsertAttendanceForEventCheckIn(
        member.id,
        user.churchId,
        event.date,
        user.id,
        event.theme,
      );

      if (existing) {
        return existing;
      }

      throw new ConflictError("Attendance already recorded for this member");
    }

    throw error;
  }
};
