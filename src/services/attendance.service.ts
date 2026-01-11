import { AttendanceStatus, Prisma, type User } from "@prisma/client";

import { AttendanceModel } from "@/models/attendance.model";
import { SessionModel } from "@/models/session.model";
import { UserModel } from "@/models/user.model";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { issuePassForAttendance, revokePass } from "@/services/pass.service";

const attendanceInclude = {
  member: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      phoneNumber: true,
    },
  },
  session: {
    select: {
      id: true,
      date: true,
      church: {
        select: {
          id: true,
          name: true,
          districtId: true,
        },
      },
    },
  },
  pass: {
    select: {
      id: true,
      token: true,
      smsSentAt: true,
    },
  },
  approvedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.AttendanceRecordInclude;

type AttendanceWithRelations = Prisma.AttendanceRecordGetPayload<{
  include: typeof attendanceInclude;
}>;

const attendanceUpdateInclude = {
  session: {
    select: {
      id: true,
      churchId: true,
    },
  },
  pass: true,
} satisfies Prisma.AttendanceRecordInclude;

type AttendanceForUpdate = Prisma.AttendanceRecordGetPayload<{
  include: typeof attendanceUpdateInclude;
}>;

export interface AttendanceFilters {
  districtId?: string | null;
  churchId?: string | null;
  sessionId?: string | null;
  status?: AttendanceStatus | null;
}

export interface CreateAttendanceInput {
  sessionId: string;
  memberId: string;
}

export interface UpdateAttendanceInput {
  status: AttendanceStatus;
  issuePass?: boolean;
}

export const buildAttendanceWhereForUser = (
  user: User,
  filters: AttendanceFilters = {},
) => {
  const where: Prisma.AttendanceRecordWhereInput = {};
  const sessionFilters: Prisma.UmugandaSessionWhereInput = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.sessionId) {
    where.sessionId = filters.sessionId;
  }

  if (user.role === "UNION_ADMIN") {
    if (!user.unionId) {
      throw new ForbiddenError("No union assigned to this account");
    }

    sessionFilters.church = {
      is: {
        district: {
          is: {
            unionId: user.unionId,
          },
        },
        ...(filters.districtId ? { districtId: filters.districtId } : {}),
        ...(filters.churchId ? { id: filters.churchId } : {}),
      },
    };
  } else if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId) {
      throw new ForbiddenError("No district assigned to this account");
    }

    if (filters.districtId && filters.districtId !== user.districtId) {
      throw new ForbiddenError("Cannot view attendance outside your district");
    }

    sessionFilters.church = {
      is: {
        districtId: user.districtId,
        ...(filters.churchId ? { id: filters.churchId } : {}),
      },
    };
  } else if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId) {
      throw new ForbiddenError("No church assigned to this account");
    }

    if (filters.churchId && filters.churchId !== user.churchId) {
      throw new ForbiddenError("Cannot view attendance outside your church");
    }

    sessionFilters.churchId = user.churchId;
  } else {
    throw new ForbiddenError("Not allowed to view attendance");
  }

  if (Object.keys(sessionFilters).length > 0) {
    where.session = { is: sessionFilters };
  }

  return where;
};

export const listAttendanceForUser = async (user: User, filters: AttendanceFilters = {}) => {
  const where = buildAttendanceWhereForUser(user, filters);

  return AttendanceModel.findMany({
    where,
    include: attendanceInclude,
    orderBy: { createdAt: "desc" },
  });
};

export const createAttendance = async (user: User, input: CreateAttendanceInput) => {
  if (user.role !== "CHURCH_ADMIN") {
    throw new ForbiddenError("Only church admins can record attendance");
  }

  if (!user.churchId) {
    throw new ForbiddenError("No church assigned to this account");
  }

  const session = await SessionModel.findById(input.sessionId, {
    include: {
      church: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!session) {
    throw new NotFoundError("Session not found");
  }

  if (session.churchId !== user.churchId) {
    throw new ForbiddenError("Cannot record attendance for another church");
  }

  const member = await UserModel.findById(input.memberId, {
    select: {
      id: true,
      role: true,
      churchId: true,
    },
  });

  if (!member || member.role !== "MEMBER") {
    throw new NotFoundError("Member not found");
  }

  if (member.churchId !== user.churchId) {
    throw new ForbiddenError("Member belongs to another church");
  }

  try {
    return await AttendanceModel.create({
      data: {
        sessionId: input.sessionId,
        memberId: input.memberId,
      },
      include: attendanceInclude,
    });
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

export const updateAttendance = async (
  user: User,
  attendanceId: string,
  input: UpdateAttendanceInput,
) => {
  if (user.role !== "CHURCH_ADMIN") {
    throw new ForbiddenError("Only church admins can update attendance");
  }

  if (!user.churchId) {
    throw new ForbiddenError("No church assigned to this account");
  }

  const existing = (await AttendanceModel.findById(attendanceId, {
    include: attendanceUpdateInclude,
  })) as AttendanceForUpdate | null;

  if (!existing) {
    throw new NotFoundError("Attendance record not found");
  }

  if (existing.session.churchId !== user.churchId) {
    throw new ForbiddenError("Cannot modify attendance outside your church");
  }

  const updated = (await AttendanceModel.update({
    where: { id: attendanceId },
    data: {
      status: input.status,
      approvedById: input.status === AttendanceStatus.APPROVED ? user.id : null,
    },
    include: attendanceInclude,
  })) as AttendanceWithRelations;

  if (input.status === AttendanceStatus.APPROVED) {
    const issuePass = input.issuePass ?? true;
    if (issuePass) {
      const pass = await issuePassForAttendance(attendanceId);
      return { attendance: updated, pass };
    }
  }

  if (input.status === AttendanceStatus.PENDING && updated.pass) {
    await revokePass(attendanceId);
  }

  return { attendance: updated };
};
