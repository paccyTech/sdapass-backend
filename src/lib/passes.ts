import crypto from "crypto";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { env } from "@/lib/env";
import { AppError, NotFoundError } from "@/lib/errors";

export const generateQrPayload = async (token: string): Promise<string> => {
  return QRCode.toDataURL(JSON.stringify({ token }));
};

export const issuePassForAttendance = async (attendanceId: string) => {
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { id: attendanceId },
    include: {
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
    },
  });

  if (!attendance) {
    throw new NotFoundError("Attendance record not found");
  }

  if (attendance.status !== "APPROVED") {
    throw new AppError("Attendance must be approved before issuing a pass", 400);
  }

  if (attendance.pass) {
    return attendance.pass;
  }

  const token = crypto.randomUUID();
  const qrPayload = await generateQrPayload(token);

  const pass = await prisma.pass.create({
    data: {
      attendanceId: attendance.id,
      token,
      qrPayload,
    },
  });

  const message = `Umuganda pass: ${attendance.member.firstName} ${attendance.member.lastName} (${attendance.session.date.toISOString().slice(0, 10)})`;

  if (env.SMS_API_KEY && attendance.member.phoneNumber) {
    await sendSms({
      to: attendance.member.phoneNumber,
      message,
    });
    await prisma.pass.update({
      where: { id: pass.id },
      data: { smsSentAt: new Date() },
    });
  }

  return pass;
};

export const verifyPassToken = async (token: string) => {
  const pass = await prisma.pass.findUnique({
    where: { token },
    include: {
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
    },
  });

  if (!pass) {
    return { valid: false } as const;
  }

  if (pass.expiresAt && pass.expiresAt.getTime() < Date.now()) {
    return { valid: false, reason: "expired" } as const;
  }

  return {
    valid: true,
    passId: pass.id,
    issuedAt: pass.createdAt,
    sessionDate: pass.attendance.session.date,
    church: pass.attendance.session.church,
  } as const;
};
