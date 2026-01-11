import { Prisma, Role, type User } from "@prisma/client";
import { randomBytes } from "crypto";

import { ChurchModel } from "@/models/church.model";
import { UserModel } from "@/models/user.model";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { hashPassword } from "@/services/auth.service";

const churchAdminSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  isActive: true,
  unionId: true,
  districtId: true,
  churchId: true,
  church: {
    select: {
      id: true,
      name: true,
      districtId: true,
    },
  },
  createdAt: true,
} satisfies Prisma.UserSelect;

export interface ChurchAdminFilters {
  districtId?: string;
  churchId?: string;
}

export interface CreateChurchAdminInput {
  churchId: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
}

export interface UpdateChurchAdminInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  churchId?: string;
  isActive?: boolean;
}

const ensureActorCanManageChurchAdmins = (actor: User) => {
  if (actor.role !== Role.UNION_ADMIN && actor.role !== Role.DISTRICT_ADMIN) {
    throw new ForbiddenError("Not allowed to manage church administrators");
  }
};

const ensureChurchWithinScope = async (actor: User, churchId: string) => {
  const church = await ChurchModel.findById(churchId, {
    select: {
      id: true,
      districtId: true,
      district: {
        select: {
          id: true,
          unionId: true,
        },
      },
    },
  });

  if (!church) {
    throw new NotFoundError("Church not found");
  }

  if (actor.role === Role.UNION_ADMIN) {
    if (actor.unionId && actor.unionId !== church.district.unionId) {
      throw new ForbiddenError("Church is outside your union");
    }
    return church;
  }

  if (actor.role === Role.DISTRICT_ADMIN) {
    if (!actor.districtId || actor.districtId !== church.districtId) {
      throw new ForbiddenError("Church is outside your district");
    }
    return church;
  }

  throw new ForbiddenError("Not allowed to manage this church");
};

const ensureAdminWithinScope = (actor: User, admin: { unionId: string | null; districtId: string | null }) => {
  if (actor.role === Role.UNION_ADMIN) {
    if (actor.unionId && admin.unionId && actor.unionId !== admin.unionId) {
      throw new ForbiddenError("Administrator belongs to another union");
    }
    return;
  }

  if (actor.role === Role.DISTRICT_ADMIN) {
    if (!actor.districtId || actor.districtId !== admin.districtId) {
      throw new ForbiddenError("Administrator belongs to another district");
    }
    return;
  }

  throw new ForbiddenError("Not allowed to manage this administrator");
};

const generateInitialPassword = () => randomBytes(6).toString("base64url");

export const listChurchAdmins = async (actor: User, filters: ChurchAdminFilters = {}) => {
  ensureActorCanManageChurchAdmins(actor);

  const where: Prisma.UserWhereInput = {
    role: Role.CHURCH_ADMIN,
  };

  if (filters.churchId) {
    where.churchId = filters.churchId;
  }

  if (filters.districtId) {
    where.districtId = filters.districtId;
  }

  if (actor.role === Role.UNION_ADMIN) {
    if (actor.unionId) {
      where.unionId = actor.unionId;
    }
  } else if (actor.role === Role.DISTRICT_ADMIN) {
    if (!actor.districtId) {
      throw new ForbiddenError("District not assigned to this account");
    }
    where.districtId = actor.districtId;
  }

  return UserModel.findMany({
    where,
    select: churchAdminSelect,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
};

export const createChurchAdmin = async (actor: User, input: CreateChurchAdminInput) => {
  ensureActorCanManageChurchAdmins(actor);

  const church = await ensureChurchWithinScope(actor, input.churchId);

  const initialPassword = generateInitialPassword();
  const passwordHash = await hashPassword(initialPassword);

  try {
    const admin = await UserModel.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        email: input.email,
        username: input.email,
        nationalId: `church-admin-${Date.now()}-${randomBytes(3).toString("hex")}`,
        passwordHash,
        role: Role.CHURCH_ADMIN,
        unionId: church.district.unionId,
        districtId: church.districtId,
        churchId: church.id,
        isActive: true,
      },
      select: churchAdminSelect,
    });

    return { admin, initialPassword };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      error.meta?.target &&
      Array.isArray(error.meta.target)
    ) {
      if (error.meta.target.includes("email")) {
        throw new ConflictError("Email already in use");
      }
      if (error.meta.target.includes("username")) {
        throw new ConflictError("Username already in use");
      }
    }

    throw error;
  }
};

export const updateChurchAdmin = async (actor: User, adminId: string, input: UpdateChurchAdminInput) => {
  ensureActorCanManageChurchAdmins(actor);

  const existing = await UserModel.findById(adminId, {
    select: {
      id: true,
      role: true,
      unionId: true,
      districtId: true,
      churchId: true,
    },
  });

  if (!existing || existing.role !== Role.CHURCH_ADMIN) {
    throw new NotFoundError("Church administrator not found");
  }

  ensureAdminWithinScope(actor, existing);

  let nextChurchId = existing.churchId ?? undefined;
  let nextDistrictId = existing.districtId ?? undefined;
  let nextUnionId = existing.unionId ?? undefined;

  if (input.churchId) {
    const church = await ensureChurchWithinScope(actor, input.churchId);
    nextChurchId = church.id;
    nextDistrictId = church.districtId;
    nextUnionId = church.district.unionId;
  }

  const data: Prisma.UserUpdateInput = {
    churchId: nextChurchId,
    districtId: nextDistrictId,
    unionId: nextUnionId,
  };

  if (input.firstName !== undefined) {
    data.firstName = input.firstName;
  }
  if (input.lastName !== undefined) {
    data.lastName = input.lastName;
  }
  if (input.phoneNumber !== undefined) {
    data.phoneNumber = input.phoneNumber;
  }
  if (input.isActive !== undefined) {
    data.isActive = input.isActive;
  }
  if (input.email !== undefined) {
    data.email = input.email;
    data.username = input.email;
  }

  try {
    const admin = await UserModel.update({
      where: { id: adminId },
      data,
      select: churchAdminSelect,
    });

    return { admin };
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      error.meta?.target &&
      Array.isArray(error.meta.target)
    ) {
      if (error.meta.target.includes("email")) {
        throw new ConflictError("Email already in use");
      }
      if (error.meta.target.includes("username")) {
        throw new ConflictError("Username already in use");
      }
    }

    throw error;
  }
};

export const deleteChurchAdmin = async (actor: User, adminId: string) => {
  ensureActorCanManageChurchAdmins(actor);

  const existing = await UserModel.findById(adminId, {
    select: {
      id: true,
      role: true,
      unionId: true,
      districtId: true,
    },
  });

  if (!existing || existing.role !== Role.CHURCH_ADMIN) {
    throw new NotFoundError("Church administrator not found");
  }

  ensureAdminWithinScope(actor, existing);

  await UserModel.delete({ where: { id: adminId } });

  return { success: true };
};
