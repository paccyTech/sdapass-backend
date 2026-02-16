import crypto from "crypto";
import { AttendanceStatus, type Prisma, type User } from "@prisma/client";

import { PassModel } from "@/models/pass.model";
import { AttendanceModel } from "@/models/attendance.model";
import { generateQrPayload } from "@/utils/qr";
import { sendSms } from "@/lib/sms";
import { env } from "@/lib/env";
import { AppError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const attendanceWithPassInclude = {
  member: true,
  session: {
    include: {
      church: {
        include: {
          district: {
            include: {
              union: true,
            },
          },
        },
      },
    },
  },
  pass: true,
} satisfies Prisma.AttendanceRecordInclude;

type AttendanceWithPass = Prisma.AttendanceRecordGetPayload<{
  include: typeof attendanceWithPassInclude;
}>;

const passWithRelationsInclude = {
  attendance: {
    include: {
      session: {
        include: {
          church: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },
  member: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      church: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
  church: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.PassInclude;

type PassWithRelations = Prisma.PassGetPayload<{
  include: typeof passWithRelationsInclude;
}>;

export const issuePassForAttendance = async (attendanceId: string) => {
  const attendance = await AttendanceModel.findById(attendanceId, {
    include: attendanceWithPassInclude,
  });

  if (!attendance) {
    throw new NotFoundError("Attendance record not found");
  }

  const attendanceWithRelations = attendance as AttendanceWithPass;

  if (attendanceWithRelations.status !== "APPROVED") {
    throw new AppError("Attendance must be approved before issuing a pass", 400);
  }

  if (attendanceWithRelations.pass) {
    return attendanceWithRelations.pass;
  }

  const token = crypto.randomUUID();
  const qrPayload = await generateQrPayload(token);

  const pass = await PassModel.create({
    data: {
      attendanceId: attendanceWithRelations.id,
      memberId: attendanceWithRelations.member.id,
      churchId: attendanceWithRelations.session.church?.id ?? null,
      token,
      qrPayload,
      sessionDate: attendanceWithRelations.session.date,
    },
  });

  const message = `Umuganda pass: ${attendanceWithRelations.member.firstName} ${attendanceWithRelations.member.lastName} (${attendanceWithRelations.session.date
    .toISOString()
    .slice(0, 10)})`;

  if (env.SMS_API_KEY && attendanceWithRelations.member.phoneNumber) {
    await sendSms({
      to: attendanceWithRelations.member.phoneNumber,
      message,
    });
    await PassModel.update({
      where: { id: pass.id },
      data: { smsSentAt: new Date() },
    });
  }

  return pass;
};

const getDayRange = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
};

const ensureSessionForChurchOnDate = async (churchId: string, date: Date) => {
  const { start, end } = getDayRange(date);

  const existing = await prisma.umugandaSession.findFirst({
    where: {
      churchId,
      date: {
        gte: start,
        lt: end,
      },
    },
    select: { id: true, churchId: true, date: true },
    orderBy: { date: "desc" },
  });

  if (existing) {
    return existing;
  }

  return prisma.umugandaSession.create({
    data: {
      churchId,
      date: start,
      theme: null,
      createdById: null,
    },
    select: { id: true, churchId: true, date: true },
  });
};

const upsertAttendanceForScan = async (memberId: string, churchId: string, scannedAt: Date) => {
  const session = await ensureSessionForChurchOnDate(churchId, scannedAt);

  return prisma.attendanceRecord.upsert({
    where: {
      sessionId_memberId: {
        sessionId: session.id,
        memberId,
      },
    },
    update: {
      status: AttendanceStatus.APPROVED,
    },
    create: {
      sessionId: session.id,
      memberId,
      status: AttendanceStatus.APPROVED,
      approvedById: null,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      session: {
        select: {
          id: true,
          date: true,
          church: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
};

export const verifyPassToken = async (user: User, token: string) => {
  let pass = await PassModel.findByToken(token, {
    include: passWithRelationsInclude,
  });

  if (!pass) {
    const memberPass = await prisma.memberPass.findUnique({
      where: { token },
      include: {
        member: {
          select: {
            id: true,
            churchId: true,
            church: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!memberPass) {
      return { valid: false } as const;
    }

    const churchId = memberPass.member?.church?.id ?? memberPass.member?.churchId ?? null;
    const sessionDate = memberPass.updatedAt ?? new Date();

    await PassModel.upsert({
      where: { memberId: memberPass.memberId },
      update: {
        token: memberPass.token,
        qrPayload: memberPass.qrPayload,
        churchId,
        sessionDate,
        expiresAt: memberPass.expiresAt ?? null,
        smsSentAt: memberPass.smsSentAt ?? null,
      },
      create: {
        memberId: memberPass.memberId,
        churchId,
        token: memberPass.token,
        qrPayload: memberPass.qrPayload,
        sessionDate,
        expiresAt: memberPass.expiresAt ?? null,
        smsSentAt: memberPass.smsSentAt ?? null,
      },
    });

    pass = await PassModel.findByToken(token, {
      include: passWithRelationsInclude,
    });

    if (!pass) {
      return { valid: false } as const;
    }
  }

  if (pass.expiresAt && pass.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: "expired" } as const;
  }

  const passWithRelations = pass as PassWithRelations;

  const church =
    passWithRelations.attendance?.session.church ??
    passWithRelations.church ??
    passWithRelations.member?.church ??
    null;

  const sessionDate =
    passWithRelations.attendance?.session.date ??
    passWithRelations.sessionDate ??
    passWithRelations.createdAt;

  if (user.role === "POLICE_VERIFIER") {
    const resolvedChurchId =
      passWithRelations.attendance?.session.church?.id ??
      passWithRelations.church?.id ??
      passWithRelations.member?.church?.id ??
      null;

    const resolvedMemberId = passWithRelations.member?.id ?? passWithRelations.memberId ?? null;

    if (resolvedMemberId && resolvedChurchId) {
      await upsertAttendanceForScan(resolvedMemberId, resolvedChurchId, new Date());
    }
  }

  // Get member details if available
  let member = null;
  if (passWithRelations.member) {
    member = {
      firstName: passWithRelations.member.firstName,
      lastName: passWithRelations.member.lastName,
      nationalId: passWithRelations.member.nationalId
    };
  } else {
    // If member is not included in the relations, fetch it separately
    const memberRecord = await prisma.user.findUnique({
      where: { id: passWithRelations.memberId },
      select: {
        firstName: true,
        lastName: true,
        nationalId: true,
      },
    });
    
    if (memberRecord) {
      member = {
        firstName: memberRecord.firstName,
        lastName: memberRecord.lastName,
        nationalId: memberRecord.nationalId
      };
    }
  }

  return {
    valid: true,
    passId: passWithRelations.id,
    issuedAt: passWithRelations.createdAt,
    sessionDate,
    church,
    member,
  } as const;
};

export const revokePass = async (attendanceId: string) => {
  const existing = await PassModel.findMany({
    where: { attendanceId },
    take: 1,
  });

  if (!existing.length) {
    throw new AppError("No pass associated with this attendance", 400);
  }

  await PassModel.delete(existing[0].id);
};
