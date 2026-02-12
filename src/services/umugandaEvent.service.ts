import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { UmugandaEventModel } from "@/models/umugandaEvent.model";
import { UmugandaEventAttendanceModel } from "@/models/umugandaEventAttendance.model";

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

    return attendance;
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Attendance already recorded for this member");
    }

    throw error;
  }
};
