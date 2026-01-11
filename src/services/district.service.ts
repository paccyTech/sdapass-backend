import type { Prisma, User } from "@prisma/client";

import { DistrictModel } from "@/models/district.model";
import { UnionModel } from "@/models/union.model";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const districtInclude = {
  union: { select: { id: true, name: true } },
  churches: { select: { id: true, name: true } },
} satisfies Prisma.DistrictInclude;

export interface DistrictFilters {
  unionId?: string;
}

export interface CreateDistrictInput {
  unionId: string;
  name: string;
  location?: string | null;
}

export interface UpdateDistrictInput {
  unionId?: string;
  name?: string;
  location?: string | null;
}

export const listDistrictsForUser = async (user: User, filters: DistrictFilters = {}) => {
  if (user.role === "UNION_ADMIN") {
    return DistrictModel.findMany({
      where: filters.unionId ? { unionId: filters.unionId } : undefined,
      include: districtInclude,
      orderBy: { name: "asc" },
    });
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId) {
      throw new ForbiddenError("No district assigned to this account");
    }

    const district = await DistrictModel.findById(user.districtId, {
      include: districtInclude,
    });

    if (!district) {
      throw new NotFoundError("District not found");
    }

    return [district];
  }

  throw new ForbiddenError("Not allowed to view districts");
};

export const createDistrict = async (user: User, input: CreateDistrictInput) => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Only union administrators can create districts");
  }

  const union = await UnionModel.findById(input.unionId);
  if (!union) {
    throw new NotFoundError("Union not found");
  }

  const district = await DistrictModel.create({
    data: {
      unionId: input.unionId,
      name: input.name,
      location: input.location,
    },
    include: districtInclude,
  });

  return district;
};

export const getDistrictForUser = async (user: User, districtId: string) => {
  const district = await DistrictModel.findById(districtId, { include: districtInclude });

  if (!district) {
    throw new NotFoundError("District not found");
  }

  if (user.role === "UNION_ADMIN") {
    if (user.unionId && district.unionId !== user.unionId) {
      throw new ForbiddenError("District does not belong to your union");
    }

    return district;
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId || user.districtId !== districtId) {
      throw new ForbiddenError("Not allowed to view this district");
    }

    return district;
  }

  throw new ForbiddenError("Not allowed to view districts");
};

export const updateDistrict = async (user: User, districtId: string, input: UpdateDistrictInput) => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Only union administrators can update districts");
  }

  const district = await DistrictModel.findById(districtId, { include: districtInclude });
  if (!district) {
    throw new NotFoundError("District not found");
  }

  if (user.unionId && district.unionId !== user.unionId) {
    throw new ForbiddenError("District does not belong to your union");
  }

  let nextUnionId = district.unionId;
  if (input.unionId !== undefined) {
    if (user.unionId && input.unionId !== user.unionId) {
      throw new ForbiddenError("Cannot move district outside your union");
    }

    const union = await UnionModel.findById(input.unionId);
    if (!union) {
      throw new NotFoundError("Union not found");
    }
    nextUnionId = union.id;
  }

  const updated = await DistrictModel.update({
    where: { id: districtId },
    data: {
      unionId: nextUnionId,
      name: input.name,
      location: input.location,
    },
    include: districtInclude,
  });

  return updated;
};

export const deleteDistrict = async (user: User, districtId: string) => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Only union administrators can delete districts");
  }

  const district = await DistrictModel.findById(districtId);
  if (!district) {
    throw new NotFoundError("District not found");
  }

  if (user.unionId && district.unionId !== user.unionId) {
    throw new ForbiddenError("District does not belong to your union");
  }

  await DistrictModel.delete({ where: { id: districtId } });
};
