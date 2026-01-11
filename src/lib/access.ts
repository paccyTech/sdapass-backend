import { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const ensureDistrictAccess = async (user: User, districtId: string) => {
  const district = await prisma.district.findUnique({
    where: { id: districtId },
    include: { union: true },
  });

  if (!district) {
    throw new NotFoundError("District not found");
  }

  if (user.role === "UNION_ADMIN") {
    return district;
  }

  if (user.role === "DISTRICT_ADMIN" && user.districtId === districtId) {
    return district;
  }

  throw new ForbiddenError("Not allowed to access this district");
};

export const ensureChurchAccess = async (user: User, churchId: string) => {
  const church = await prisma.church.findUnique({
    where: { id: churchId },
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
    return church;
  }

  if (user.role === "DISTRICT_ADMIN" && user.districtId === church.districtId) {
    return church;
  }

  if (user.role === "CHURCH_ADMIN" && user.churchId === churchId) {
    return church;
  }

  throw new ForbiddenError("Not allowed to access this church");
};

export const ensureSessionAccess = async (user: User, sessionId: string) => {
  const session = await prisma.umugandaSession.findUnique({
    where: { id: sessionId },
    include: {
      church: {
        include: {
          district: true,
        },
      },
    },
  });

  if (!session) {
    throw new NotFoundError("Session not found");
  }

  if (user.role === "UNION_ADMIN") {
    return session;
  }

  if (user.role === "DISTRICT_ADMIN" && user.districtId === session.church.districtId) {
    return session;
  }

  if (user.role === "CHURCH_ADMIN" && user.churchId === session.churchId) {
    return session;
  }

  throw new ForbiddenError("Not allowed to access this session");
};
