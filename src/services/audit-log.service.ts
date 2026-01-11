import type { Prisma, Role, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/errors";

type Nullable<T> = T | null | undefined;

type AuditUserContext = {
  id?: string | null;
  role?: Role | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  unionId?: string | null;
  districtId?: string | null;
  churchId?: string | null;
};

const extractIpAddress = (req: Request): string | null => {
  const forwardedFor = req.headers.get("x-forwarded-for") ?? req.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    return forwardedFor.split(",").map((value) => value.trim()).find(Boolean) ?? null;
  }

  const realIp =
    req.headers.get("x-real-ip") ??
    req.headers.get("X-Real-Ip") ??
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("CF-Connecting-Ip");
  if (realIp) {
    return realIp;
  }

  return null;
};

const buildUserDisplayName = (user: Nullable<AuditUserContext>): string => {
  if (!user) {
    return "Unknown";
  }

  const fullName = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  if (fullName) {
    return fullName;
  }

  return user.username ?? "Unknown";
};

export type RecordAuditLogInput = {
  req: Request;
  user?: Nullable<AuditUserContext>;
  action: string;
  details?: Prisma.InputJsonValue;
};

export const recordAuditLog = async ({ req, user, action, details }: RecordAuditLogInput) => {
  try {
    const ipAddress = extractIpAddress(req);
    const userAgent = req.headers.get("user-agent") ?? req.headers.get("User-Agent") ?? null;

    await prisma.auditLog.create({
      data: {
        action,
        userName: buildUserDisplayName(user),
        userRole: user?.role ?? null,
        userId: user?.id ?? null,
        unionId: user?.unionId ?? null,
        districtId: user?.districtId ?? null,
        churchId: user?.churchId ?? null,
        ipAddress,
        userAgent,
        details: details ?? undefined,
      },
    });
  } catch (error) {
    // Audit logging should never block core flow; surface during development only.
    console.error("Failed to record audit log", error);
  }
};

export type AuditLogFilters = {
  action?: string;
  role?: Role;
  search?: string;
  cursor?: string;
  limit?: number;
};

export interface AuditLogListResult {
  logs: Awaited<ReturnType<typeof prisma.auditLog.findMany>>;
  total: number;
  countsByAction: Array<{ action: string; count: number }>;
  countsByRole: Array<{ role: Role | null; count: number }>;
  nextCursor: string | null;
}

const buildSearchWhere = (search?: string): Prisma.AuditLogWhereInput | undefined => {
  if (!search) {
    return undefined;
  }

  return {
    OR: [
      { userName: { contains: search, mode: "insensitive" } },
      { action: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search, mode: "insensitive" } },
      { userAgent: { contains: search, mode: "insensitive" } },
    ],
  } satisfies Prisma.AuditLogWhereInput;
};

export const listAuditLogsForUnionAdmin = async (
  user: User,
  { action, role, search, cursor, limit = 25 }: AuditLogFilters,
): Promise<AuditLogListResult> => {
  if (user.role !== "UNION_ADMIN") {
    throw new ForbiddenError("Only union admins can view audit logs");
  }

  if (!user.unionId) {
    throw new ForbiddenError("Union context is required to view audit logs");
  }

  const where: Prisma.AuditLogWhereInput = {
    unionId: user.unionId,
    ...(action ? { action } : {}),
    ...(role ? { userRole: role } : {}),
  };

  const searchWhere = buildSearchWhere(search);
  if (searchWhere) {
    where.AND = where.AND ?? [];
    where.AND.push(searchWhere);
  }

  const take = Math.min(Math.max(limit, 1), 100);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: take + 1,
    cursor: cursor ? { id: cursor } : undefined,
    skip: cursor ? 1 : 0,
  });

  const totalPromise = prisma.auditLog.count({ where });
  const countsByActionPromise = prisma.auditLog.groupBy({
    where,
    by: ["action"],
    _count: { action: true },
  });
  const countsByRolePromise = prisma.auditLog.groupBy({
    where,
    by: ["userRole"],
    _count: { userRole: true },
  });

  const [total, countsByActionRaw, countsByRoleRaw] = await Promise.all([
    totalPromise,
    countsByActionPromise,
    countsByRolePromise,
  ]);

  let nextCursor: string | null = null;
  if (logs.length > take) {
    const nextItem = logs.pop();
    nextCursor = nextItem ? nextItem.id : null;
  }

  return {
    logs,
    total,
    countsByAction: countsByActionRaw.map((row) => ({ action: row.action, count: row._count.action })),
    countsByRole: countsByRoleRaw.map((row) => ({ role: row.userRole ?? null, count: row._count.userRole })),
    nextCursor,
  } satisfies AuditLogListResult;
};
