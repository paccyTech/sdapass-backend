import { Role, type Prisma, type User } from "@prisma/client";
import { randomBytes } from "crypto";

import { hashPassword } from "@/services/auth.service";
import { UserModel } from "@/models/user.model";
import { DistrictModel } from "@/models/district.model";
import { ChurchModel } from "@/models/church.model";
import { ForbiddenError, NotFoundError, ConflictError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

const districtPastorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phoneNumber: true,
  isActive: true,
  districtId: true,
  district: {
    select: {
      id: true,
      name: true,
      unionId: true,
    },
  },
  pastorChurches: {
    select: {
      id: true,
      name: true,
      districtId: true,
    },
  },
  createdAt: true,
} satisfies Prisma.UserSelect;

export interface DistrictPastorFilters {
  districtId?: string;
}

export interface CreateDistrictPastorInput {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  districtId: string;
}

export interface UpdateDistrictPastorInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  email?: string;
  districtId?: string | null;
  isActive?: boolean;
}

const assertUnionAdmin = (user: User) => {
  if (user.role !== Role.UNION_ADMIN) {
    throw new ForbiddenError("Only union administrators can manage district pastors");
  }
};

export const listDistrictPastors = async (actor: User, filters: DistrictPastorFilters = {}) => {
  assertUnionAdmin(actor);

  const where: Prisma.UserWhereInput = {
    role: Role.DISTRICT_ADMIN,
    unionId: actor.unionId ?? undefined,
  };

  if (filters.districtId) {
    where.districtId = filters.districtId;
  }

  return UserModel.findMany({
    where,
    select: districtPastorSelect,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
};

const generateInitialPassword = () => {
  return randomBytes(6).toString("base64url");
};

export const createDistrictPastor = async (actor: User, input: CreateDistrictPastorInput) => {
  assertUnionAdmin(actor);

  const district = await DistrictModel.findById(input.districtId, {
    include: { union: true },
  });

  if (!district) {
    throw new NotFoundError("District not found");
  }

  if (district.unionId !== actor.unionId) {
    throw new ForbiddenError("District does not belong to your union");
  }

  const initialPassword = generateInitialPassword();
  const passwordHash = await hashPassword(initialPassword);

  try {
    const pastor = await UserModel.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.phoneNumber,
        email: input.email,
        username: input.email,
        nationalId: `pastor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        passwordHash,
        role: Role.DISTRICT_ADMIN,
        unionId: district.unionId,
        districtId: district.id,
        isActive: true,
      },
      select: districtPastorSelect,
    });

    return { pastor, initialPassword };
  } catch (error) {
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

export const updateDistrictPastor = async (
  actor: User,
  pastorId: string,
  input: UpdateDistrictPastorInput,
) => {
  assertUnionAdmin(actor);

  const pastor = await UserModel.findById(pastorId, {
    select: {
      id: true,
      unionId: true,
      districtId: true,
      role: true,
    },
  });

  if (!pastor || pastor.role !== Role.DISTRICT_ADMIN) {
    throw new NotFoundError("District pastor not found");
  }

  if (pastor.unionId && actor.unionId && pastor.unionId !== actor.unionId) {
    throw new ForbiddenError("Cannot modify a pastor outside your union");
  }

  let newDistrictId = pastor.districtId;
  if (input.districtId !== undefined) {
    if (input.districtId === null) {
      newDistrictId = null;
    } else {
      const district = await DistrictModel.findById(input.districtId);
      if (!district) {
        throw new NotFoundError("District not found");
      }
      if (actor.unionId && district.unionId !== actor.unionId) {
        throw new ForbiddenError("District does not belong to your union");
      }
      newDistrictId = district.id;
    }
  }

  const updated = await UserModel.update({
    where: { id: pastorId },
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phoneNumber: input.phoneNumber,
      districtId: newDistrictId,
      isActive: input.isActive,
    },
    select: districtPastorSelect,
  });

  return updated;
};

export const assignChurchesToPastor = async (
  actor: User,
  pastorId: string,
  churchIds: string[],
) => {
  assertUnionAdmin(actor);

  const pastor = await UserModel.findById(pastorId, {
    select: {
      id: true,
      unionId: true,
      districtId: true,
      role: true,
    },
  });

  if (!pastor || pastor.role !== Role.DISTRICT_ADMIN) {
    throw new NotFoundError("District pastor not found");
  }

  if (!pastor.districtId) {
    throw new ConflictError("Assign a district before linking churches");
  }

  const churches = await ChurchModel.findMany({
    where: { id: { in: churchIds } },
    select: { id: true, districtId: true },
  });

  if (churches.length !== churchIds.length) {
    throw new NotFoundError("One or more churches were not found");
  }

  const invalidChurch = churches.find((church) => church.districtId !== pastor.districtId);
  if (invalidChurch) {
    throw new ConflictError("All churches must belong to the pastor's district");
  }

  await prisma.$transaction([
    prisma.church.updateMany({
      where: {
        districtPastorId: pastorId,
        ...(churchIds.length ? { id: { notIn: churchIds } } : {}),
      },
      data: { districtPastorId: null },
    }),
    ...(churchIds.length
      ? [
          prisma.church.updateMany({
            where: { id: { in: churchIds } },
            data: { districtPastorId: pastorId },
          }),
        ]
      : []),
  ]);

  const refreshed = await UserModel.findById(pastorId, { select: districtPastorSelect });
  return refreshed;
};

export const deleteDistrictPastor = async (actor: User, pastorId: string) => {
  assertUnionAdmin(actor);

  const pastor = await UserModel.findById(pastorId, {
    select: {
      id: true,
      unionId: true,
      role: true,
    },
  });

  if (!pastor || pastor.role !== Role.DISTRICT_ADMIN) {
    throw new NotFoundError("District pastor not found");
  }

  if (pastor.unionId && actor.unionId && pastor.unionId !== actor.unionId) {
    throw new ForbiddenError("Cannot delete a pastor outside your union");
  }

  await UserModel.delete({ where: { id: pastorId } });
};
