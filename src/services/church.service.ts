import type { Prisma, User } from "@prisma/client";

import { ChurchModel } from "@/models/church.model";
import { DistrictModel } from "@/models/district.model";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const churchInclude = {
  district: {
    select: {
      id: true,
      name: true,
      unionId: true,
    },
  },
  _count: {
    select: {
      members: true,
      sessions: true,
    },
  },
} satisfies Prisma.ChurchInclude;

export interface ChurchFilters {
  districtId?: string;
}

export interface CreateChurchInput {
  districtId: string;
  name: string;
  location?: string | null;
}

export interface UpdateChurchInput {
  name?: string;
  location?: string | null;
  districtId?: string;
}

export const listChurchesForUser = async (user: User, filters: ChurchFilters = {}) => {
  if (user.role === "UNION_ADMIN") {
    return ChurchModel.findMany({
      where: filters.districtId ? { districtId: filters.districtId } : undefined,
      include: churchInclude,
      orderBy: { name: "asc" },
    });
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId) {
      throw new ForbiddenError("No district assigned to this account");
    }

    if (filters.districtId && filters.districtId !== user.districtId) {
      throw new ForbiddenError("Cannot view churches outside your district");
    }

    return ChurchModel.findMany({
      where: { districtId: user.districtId },
      include: churchInclude,
      orderBy: { name: "asc" },
    });
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId) {
      throw new ForbiddenError("No church assigned to this account");
    }

    const church = await ChurchModel.findById(user.churchId, {
      where: { id: user.churchId },
      include: churchInclude,
    });
    if (!church) {
      throw new NotFoundError("Church not found");
    }

    return [church];
  }

  throw new ForbiddenError("Not allowed to view churches");
};

export const createChurch = async (user: User, input: CreateChurchInput) => {
  if (user.role !== "UNION_ADMIN" && user.role !== "DISTRICT_ADMIN") {
    throw new ForbiddenError("Not allowed to create churches");
  }

  const district = await DistrictModel.findById(input.districtId, {
    include: {
      union: true,
    },
  });

  if (!district) {
    throw new NotFoundError("District not found");
  }

  if (user.role === "UNION_ADMIN") {
    if (user.unionId && district.unionId !== user.unionId) {
      throw new ForbiddenError("Cannot create church outside your union");
    }
  }

  if (user.role === "DISTRICT_ADMIN" && user.districtId !== district.id) {
    throw new ForbiddenError("Cannot create church outside your district");
  }

  return ChurchModel.create({
    data: {
      districtId: input.districtId,
      name: input.name,
      location: input.location,
    },
    include: churchInclude,
  });
};

export const getChurchForUser = async (user: User, churchId: string) => {
  const church = await ChurchModel.findById(churchId, {
    include: churchInclude,
  });

  if (!church) {
    throw new NotFoundError("Church not found");
  }

  if (user.role === "UNION_ADMIN") {
    if (user.unionId && church.district?.unionId !== user.unionId) {
      throw new ForbiddenError("Cannot view church outside your union");
    }
    return church;
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId || user.districtId !== church.districtId) {
      throw new ForbiddenError("Cannot view church outside your district");
    }
    return church;
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId || user.churchId !== church.id) {
      throw new ForbiddenError("Cannot view another church");
    }
    return church;
  }

  throw new ForbiddenError("Not allowed to view churches");
};

export const updateChurch = async (user: User, churchId: string, input: UpdateChurchInput) => {
  const church = await ChurchModel.findById(churchId, {
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

  if (user.role === "UNION_ADMIN") {
    if (user.unionId && church.district.unionId !== user.unionId) {
      throw new ForbiddenError("Cannot modify church outside your union");
    }
  } else if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId || user.districtId !== church.districtId) {
      throw new ForbiddenError("Cannot modify church outside your district");
    }
  } else if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId || user.churchId !== church.id) {
      throw new ForbiddenError("Cannot modify another church");
    }
  } else {
    throw new ForbiddenError("Not allowed to update churches");
  }

  let nextDistrictId = church.districtId;
  if (input.districtId) {
    const targetDistrict = await DistrictModel.findById(input.districtId, {
      include: { union: true },
    });

    if (!targetDistrict) {
      throw new NotFoundError("District not found");
    }

    if (user.role === "UNION_ADMIN") {
      if (user.unionId && targetDistrict.unionId !== user.unionId) {
        throw new ForbiddenError("Cannot move church outside your union");
      }
    } else if (user.role === "DISTRICT_ADMIN") {
      if (!user.districtId || user.districtId !== targetDistrict.id) {
        throw new ForbiddenError("Cannot move church outside your district");
      }
    } else {
      throw new ForbiddenError("Not allowed to move church");
    }

    nextDistrictId = targetDistrict.id;
  }

  const updated = await ChurchModel.update({
    where: { id: churchId },
    data: {
      name: input.name,
      location: input.location,
      districtId: nextDistrictId,
    },
    include: churchInclude,
  });

  return updated;
};

export const deleteChurch = async (user: User, churchId: string) => {
  const church = await ChurchModel.findById(churchId, {
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

  if (user.role === "UNION_ADMIN") {
    if (user.unionId && church.district.unionId !== user.unionId) {
      throw new ForbiddenError("Cannot delete church outside your union");
    }
  } else if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId || user.districtId !== church.districtId) {
      throw new ForbiddenError("Cannot delete church outside your district");
    }
  } else {
    throw new ForbiddenError("Not allowed to delete churches");
  }

  await ChurchModel.delete({ where: { id: churchId } });

  return { success: true };
};
