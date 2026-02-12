import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ConflictError } from "@/lib/errors";
import { UserModel } from "@/models/user.model";

export type UpdateMeInput = {
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phoneNumber?: string;
};

const normalizeEmail = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const getMe = async (userId: string) => {
  const user = await UserModel.findById(userId);
  return user;
};

export const updateMe = async (user: User, input: UpdateMeInput) => {
  const nextEmail = normalizeEmail(input.email);
  const nextPhone = input.phoneNumber?.trim();

  if (nextEmail && nextEmail !== user.email) {
    const existing = await UserModel.findByEmail(nextEmail);
    if (existing && existing.id !== user.id) {
      throw new ConflictError("Email already in use");
    }
  }

  if (nextPhone && nextPhone !== user.phoneNumber) {
    const existing = await UserModel.findByPhoneNumber(nextPhone);
    if (existing && existing.id !== user.id) {
      throw new ConflictError("Phone number already in use");
    }
  }

  const data: Prisma.UserUpdateInput = {
    ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
    ...(nextEmail !== undefined ? { email: nextEmail } : {}),
    ...(nextPhone !== undefined ? { phoneNumber: nextPhone } : {}),
  };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
  });

  return updated;
};
