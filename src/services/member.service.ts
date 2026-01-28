import { Prisma, type User } from "@prisma/client";
import crypto from "crypto";

import { UserModel } from "@/models/user.model";
import { ChurchModel } from "@/models/church.model";
import { PassModel } from "@/models/pass.model";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { hashPassword } from "@/services/auth.service";
import { generateQrPayload } from "@/utils/qr";
import { sendSms } from "@/lib/sms";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const memberSelect = {
  id: true,
  nationalId: true,
  firstName: true,
  lastName: true,
  phoneNumber: true,
  email: true,
  church: {
    select: {
      id: true,
      name: true,
      districtId: true,
    },
  },
  createdAt: true,
} satisfies Prisma.UserSelect;

type MemberRecord = Prisma.UserGetPayload<{ select: typeof memberSelect }>;

type MemberPassRecord = {
  token: string;
  smsSentAt: Date | null;
  expiresAt: Date | null;
};

export type MemberSummary = {
  id: string;
  nationalId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string | null;
  createdAt: string;
  church: {
    id: string;
    name: string;
    districtId: string;
  } | null;
  memberPass: {
    token: string;
    smsSentAt: string | null;
    expiresAt: string | null;
  } | null;
};

const toMemberSummary = (member: MemberRecord, pass?: MemberPassRecord | null): MemberSummary => ({
  id: member.id,
  nationalId: member.nationalId,
  firstName: member.firstName,
  lastName: member.lastName,
  phoneNumber: member.phoneNumber,
  email: member.email,
  createdAt: member.createdAt.toISOString(),
  church: member.church
    ? {
        id: member.church.id,
        name: member.church.name,
        districtId: member.church.districtId,
      }
    : null,
  memberPass: pass
    ? {
        token: pass.token,
        smsSentAt: pass.smsSentAt ? pass.smsSentAt.toISOString() : null,
        expiresAt: pass.expiresAt ? pass.expiresAt.toISOString() : null,
      }
    : null,
});

export interface MemberFilters {
  districtId?: string;
  churchId?: string;
}

export interface CreateMemberInput {
  nationalId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email?: string | null;
  password: string;
}

export interface CreateMemberResult {
  member: MemberSummary;
  memberPass: {
    id: string;
    token: string;
    qrPayload: string;
    smsSentAt: Date | null;
  };
}

const DEFAULT_FRONTEND_URL = env.CORS_ORIGIN || "http://localhost:3000";

export interface UpdateMemberInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string | null;
}

const ensureMemberScope = (user: User, filters: MemberFilters) => {
  if (user.role === "UNION_ADMIN") {
    return;
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId) {
      throw new ForbiddenError("No district assigned to this account");
    }
    if (filters.districtId && filters.districtId !== user.districtId) {
      throw new ForbiddenError("Cannot view members outside your district");
    }
    return;
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId) {
      throw new ForbiddenError("No church assigned to this account");
    }
    if (filters.churchId && filters.churchId !== user.churchId) {
      throw new ForbiddenError("Cannot view members outside your church");
    }
    return;
  }

  throw new ForbiddenError("Not allowed to view members");
};

const ensureMemberAccess = (
  user: User,
  member: { unionId: string | null; districtId: string | null; churchId: string | null },
) => {
  if (user.role === "UNION_ADMIN") {
    if (user.unionId && member.unionId && user.unionId !== member.unionId) {
      throw new ForbiddenError("Member belongs to another union");
    }
    return;
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId || user.districtId !== member.districtId) {
      throw new ForbiddenError("Member belongs to another district");
    }
    return;
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId || user.churchId !== member.churchId) {
      throw new ForbiddenError("Member belongs to another church");
    }
    return;
  }

  throw new ForbiddenError("Not allowed to manage members");
};

export const updateMember = async (user: User, memberId: string, input: UpdateMemberInput) => {
  const existing = await UserModel.findById(memberId, {
    select: {
      id: true,
      role: true,
      unionId: true,
      districtId: true,
      churchId: true,
    },
  });

  if (!existing || existing.role !== "MEMBER") {
    throw new NotFoundError("Member not found");
  }

  ensureMemberAccess(user, existing);

  const data: Prisma.UserUpdateInput = {};

  if (input.firstName !== undefined) {
    data.firstName = input.firstName;
  }
  if (input.lastName !== undefined) {
    data.lastName = input.lastName;
  }
  if (input.phoneNumber !== undefined) {
    data.phoneNumber = input.phoneNumber;
  }
  if (input.email !== undefined) {
    data.email = input.email;
  }

  if (Object.keys(data).length === 0) {
    const member = await UserModel.findById(memberId, { select: memberSelect });
    return { member };
  }

  try {
    const member = await UserModel.update({
      where: { id: memberId },
      data,
      select: memberSelect,
    });

    return { member };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      error.meta?.target &&
      Array.isArray(error.meta.target) &&
      error.meta.target.includes("email")
    ) {
      throw new ConflictError("Email already in use");
    }

    throw error;
  }
};

export const deleteMember = async (user: User, memberId: string) => {
  const existing = await UserModel.findById(memberId, {
    select: {
      id: true,
      role: true,
      unionId: true,
      districtId: true,
      churchId: true,
    },
  });

  if (!existing || existing.role !== "MEMBER") {
    throw new NotFoundError("Member not found");
  }

  ensureMemberAccess(user, existing);

  await prisma.memberPass.deleteMany({ where: { memberId } });

  await UserModel.delete({ where: { id: memberId } });

  return { success: true };
};

export const listMembersForUser = async (user: User, filters: MemberFilters = {}) => {
  ensureMemberScope(user, filters);

  const where: Prisma.UserWhereInput = {
    role: "MEMBER",
  };

  if (filters.districtId) {
    where.districtId = filters.districtId;
  }

  if (filters.churchId) {
    where.churchId = filters.churchId;
  }

  if (user.role === "DISTRICT_ADMIN" && !filters.districtId) {
    where.districtId = user.districtId ?? undefined;
  }

  if (user.role === "CHURCH_ADMIN" && !filters.churchId) {
    where.churchId = user.churchId ?? undefined;
  }

  const members = (await prisma.user.findMany({
    where,
    select: memberSelect,
    orderBy: { lastName: "asc" },
  })) as MemberRecord[];

  if (members.length === 0) {
    return [];
  }

  const memberIds = members.map((member) => member.id);
  const passes = await prisma.memberPass.findMany({
    where: { memberId: { in: memberIds } },
    select: {
      memberId: true,
      token: true,
      smsSentAt: true,
      expiresAt: true,
    },
  });

  const passByMember = new Map<string, MemberPassRecord>();
  passes.forEach((pass) => {
    passByMember.set(pass.memberId, {
      token: pass.token,
      smsSentAt: pass.smsSentAt,
      expiresAt: pass.expiresAt,
    });
  });

  return members.map((member) => toMemberSummary(member, passByMember.get(member.id) ?? null));
};

export const getMemberPassForUser = async (user: User, memberId: string) => {
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: {
      id: true,
      role: true,
      unionId: true,
      districtId: true,
      churchId: true,
      firstName: true,
      lastName: true,
      nationalId: true,
      phoneNumber: true,
      email: true,
      church: {
        select: {
          id: true,
          name: true,
          districtId: true,
        },
      },
      createdAt: true,
    },
  });

  if (!member || member.role !== "MEMBER") {
    throw new NotFoundError("Member not found");
  }

  if (user.role === "MEMBER") {
    if (user.id !== member.id) {
      throw new ForbiddenError("Not allowed to view other member passes");
    }
  } else {
    ensureMemberAccess(user, member);
  }

  const pass = await prisma.memberPass.findUnique({
    where: { memberId },
    select: {
      id: true,
      token: true,
      qrPayload: true,
      expiresAt: true,
      smsSentAt: true,
    },
  });

  if (!pass) {
    throw new NotFoundError("Member pass not found");
  }

  return {
    member: {
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      nationalId: member.nationalId,
      phoneNumber: member.phoneNumber,
      email: member.email,
      createdAt: member.createdAt.toISOString(),
      church: member.church
        ? {
            id: member.church.id,
            name: member.church.name,
            districtId: member.church.districtId,
          }
        : null,
    },
    pass: {
      ...pass,
      smsSentAt: pass.smsSentAt ? pass.smsSentAt.toISOString() : null,
      expiresAt: pass.expiresAt ? pass.expiresAt.toISOString() : null,
    },
  };
};

export const createMember = async (user: User, input: CreateMemberInput): Promise<CreateMemberResult> => {
  if (user.role !== "CHURCH_ADMIN") {
    throw new ForbiddenError("Only church admins can create members");
  }

  if (!user.churchId) {
    throw new ForbiddenError("No church assigned to this account");
  }

  const church = await ChurchModel.findById(user.churchId, {
    where: { id: user.churchId },
    include: {
      district: {
        include: {
          union: true,
        },
      },
    },
  });

  if (!church) {
    throw new NotFoundError("Church not found");
  }

  if (input.email) {
    const existingByEmail = await UserModel.findByEmail(input.email);
    if (existingByEmail) {
      throw new ConflictError("A user with this email already exists");
    }
  }

  const existingByPhone = await UserModel.findByPhoneNumber(input.phoneNumber);
  if (existingByPhone) {
    throw new ConflictError("A user with this phone number already exists");
  }

  const passwordHash = await hashPassword(input.password);

  try {
    const member = (await UserModel.create({
      data: {
        username: input.nationalId,
        nationalId: input.nationalId,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        email: input.email,
        passwordHash,
        role: "MEMBER",
        unionId: church.district.unionId,
        districtId: church.districtId,
        churchId: church.id,
      },
      select: memberSelect,
    })) as MemberRecord;

    const passToken = crypto.randomUUID();
    const qrPayload = await generateQrPayload(passToken);

    let memberPassRecord = await prisma.memberPass.create({
      data: {
        memberId: member.id,
        token: passToken,
        qrPayload,
      },
    });

    await PassModel.upsert({
      where: { memberId: member.id },
      update: {
        token: passToken,
        qrPayload,
        sessionDate: new Date(),
        churchId: member.church?.id ?? null,
      },
      create: {
        memberId: member.id,
        churchId: member.church?.id ?? null,
        token: passToken,
        qrPayload,
        sessionDate: new Date(),
      },
    });

    const loginUrl = `${DEFAULT_FRONTEND_URL}/login`;
    const passUrl = `${DEFAULT_FRONTEND_URL}/member/pass`;

    let smsSentAt: Date | null = null;

    if (member.phoneNumber) {
      const message = [
        `Murakaza neza mu Umuganda SDA, ${member.firstName}.`,
        `Injira kuri ${loginUrl} ukoresheje iri nambara y'indangamuntu: ${member.nationalId}.`,
        `Ijambo ry'ibanga wahawe: ${input.password}.`,
        `Ikarita yawe ya QR iri hano: ${passUrl}.`,
      ].join(" ");

      try {
        await sendSms({
          to: member.phoneNumber,
          message,
        });
        smsSentAt = new Date();
        memberPassRecord = await prisma.memberPass.update({
          where: { id: memberPassRecord.id },
          data: { smsSentAt },
        });
      } catch (smsError) {
        // Log and continue without failing member creation
        console.error("Failed to send member onboarding SMS", smsError);
      }
    }

    return {
      member: toMemberSummary(member, {
        token: memberPassRecord.token,
        smsSentAt: memberPassRecord.smsSentAt,
        expiresAt: memberPassRecord.expiresAt,
      }),
      memberPass: {
        id: memberPassRecord.id,
        token: passToken,
        qrPayload,
        smsSentAt,
      },
    } satisfies CreateMemberResult;
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = Array.isArray(error.meta?.target) ? error.meta?.target : [];

      if (target.includes("nationalId") || target.includes("username")) {
        throw new ConflictError("A member with this national ID already exists");
      }

      if (target.includes("email")) {
        throw new ConflictError("A user with this email already exists");
      }

      throw new ConflictError("Member already exists");
    }

    throw error;
  }
};
