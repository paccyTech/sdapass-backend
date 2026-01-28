import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role, type User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { UnauthorizedError } from "@/lib/errors";
import { UserModel } from "@/models/user.model";

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

type JwtPayload = {
  sub: string;
  role: Role;
  unionId?: string | null;
  districtId?: string | null;
  churchId?: string | null;
};

export type TokenSubject = Pick<User, "id" | "role" | "unionId" | "districtId" | "churchId">;

export type AuthUser = Omit<User, "passwordHash">;

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

export const signToken = (user: TokenSubject): string => {
  const payload: JwtPayload = {
    sub: user.id,
    role: user.role,
    unionId: user.unionId,
    districtId: user.districtId,
    churchId: user.churchId,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: TOKEN_TTL_SECONDS,
  });
};

export const getUserFromToken = async (token: string): Promise<User> => {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
    });

    if (!user) {
      throw new UnauthorizedError("User not found");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account disabled");
    }

    return user;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    throw new UnauthorizedError("Invalid token");
  }
};

type CredentialInput = {
  email?: string;
  phoneNumber?: string;
  password: string;
};

export const authenticateWithCredentials = async ({
  email,
  phoneNumber,
  password,
}: CredentialInput) => {
  let user: User | null = null;

  if (phoneNumber) {
    user = await UserModel.findByPhoneNumber(phoneNumber);

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (user.role !== Role.MEMBER) {
      throw new UnauthorizedError("Phone number login is restricted to members");
    }
  } else if (email) {
    user = await UserModel.findByEmail(email);

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid credentials");
    }

    if (user.role === Role.MEMBER) {
      throw new UnauthorizedError("Members must sign in with their phone number");
    }
  } else {
    throw new UnauthorizedError("Email or phone number is required");
  }

  const validPassword = await verifyPassword(password, user.passwordHash);

  if (!validPassword) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = signToken({
    id: user.id,
    role: user.role,
    unionId: user.unionId,
    districtId: user.districtId,
    churchId: user.churchId,
  });

  const { passwordHash, ...safeUser } = user;

  return {
    token,
    user: safeUser as AuthUser,
  } satisfies { token: string; user: AuthUser };
};
