import type { Prisma, User } from "@prisma/client";

import { SessionModel } from "@/models/session.model";
import { ChurchModel } from "@/models/church.model";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

const sessionInclude = {
  church: {
    select: {
      id: true,
      name: true,
      districtId: true,
    },
  },
  _count: {
    select: {
      attendance: true,
    },
  },
} satisfies Prisma.UmugandaSessionInclude;

export interface SessionFilters {
  districtId?: string;
  churchId?: string;
}

export interface CreateSessionInput {
  date: Date;
  theme?: string | null;
}

const ensureSessionFilters = (user: User, filters: SessionFilters) => {
  if (user.role === "UNION_ADMIN") {
    return;
  }

  if (user.role === "DISTRICT_ADMIN") {
    if (!user.districtId) {
      throw new ForbiddenError("No district assigned to this account");
    }

    if (filters.districtId && filters.districtId !== user.districtId) {
      throw new ForbiddenError("Cannot view sessions outside your district");
    }

    return;
  }

  if (user.role === "CHURCH_ADMIN") {
    if (!user.churchId) {
      throw new ForbiddenError("No church assigned to this account");
    }

    if (filters.churchId && filters.churchId !== user.churchId) {
      throw new ForbiddenError("Cannot view sessions outside your church");
    }

    return;
  }

  throw new ForbiddenError("Not allowed to view sessions");
};

export const listSessionsForUser = async (user: User, filters: SessionFilters = {}) => {
  ensureSessionFilters(user, filters);

  const where: Prisma.UmugandaSessionWhereInput = {};

  if (filters.districtId) {
    where.church = { districtId: filters.districtId };
  }

  if (filters.churchId) {
    where.churchId = filters.churchId;
  }

  if (user.role === "DISTRICT_ADMIN" && !filters.districtId) {
    where.church = { districtId: user.districtId ?? undefined };
  }

  if (user.role === "CHURCH_ADMIN" && !filters.churchId) {
    where.churchId = user.churchId ?? undefined;
  }

  return SessionModel.findMany({
    where,
    include: sessionInclude,
    orderBy: { date: "desc" },
  });
};

export const createSession = async (user: User, input: CreateSessionInput) => {
  if (user.role !== "CHURCH_ADMIN") {
    throw new ForbiddenError("Only church admins can create sessions");
  }

  if (!user.churchId) {
    throw new ForbiddenError("No church assigned to this account");
  }

  const church = await ChurchModel.findById(user.churchId, {
    where: { id: user.churchId },
    select: {
      id: true,
    },
  });

  if (!church) {
    throw new NotFoundError("Church not found");
  }

  return SessionModel.create({
    data: {
      churchId: church.id,
      date: input.date,
      theme: input.theme,
      createdById: user.id,
    },
    include: sessionInclude,
  });
};
