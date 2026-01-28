import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type UserFindUniqueArgsWithoutWhere = Omit<Prisma.UserFindUniqueArgs, "where">;

export const UserModel = {
  findById: (id: string, args?: UserFindUniqueArgsWithoutWhere) =>
    prisma.user.findUnique({ where: { id }, ...(args ?? {}) }),

  findByUsername: (username: string, args?: UserFindUniqueArgsWithoutWhere) =>
    prisma.user.findUnique({ where: { username }, ...(args ?? {}) }),

  findByEmail: (email: string, args?: UserFindUniqueArgsWithoutWhere) =>
    prisma.user.findUnique({ where: { email }, ...(args ?? {}) }),

  findByPhoneNumber: (
    phoneNumber: string,
    args?: UserFindUniqueArgsWithoutWhere,
  ) =>
    prisma.user.findUnique({
      where: { phoneNumber } as Prisma.UserWhereUniqueInput,
      ...(args ?? {}),
    }),

  findByNationalId: (nationalId: string, args?: UserFindUniqueArgsWithoutWhere) =>
    prisma.user.findUnique({ where: { nationalId }, ...(args ?? {}) }),

  findMany: (args?: Prisma.UserFindManyArgs) => prisma.user.findMany(args),

  count: (args?: Prisma.UserCountArgs) => prisma.user.count(args),

  create: (args: Prisma.UserCreateArgs) => prisma.user.create(args),

  update: (args: Prisma.UserUpdateArgs) => prisma.user.update(args),

  delete: (args: Prisma.UserDeleteArgs) => prisma.user.delete(args),
};

export type UserWithContext = User;
