import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { UnauthorizedError } from "@/lib/errors";

type JwtPayload = {
  sub: string;
  role: Role;
  unionId?: string | null;
  districtId?: string | null;
  churchId?: string | null;
};

type TokenSubject = Pick<User, "id" | "role" | "unionId" | "districtId" | "churchId">;

const TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const verifyPassword = async (
  password: string,
  hash: string,
): Promise<boolean> => {
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

export const verifyToken = (token: string): JwtPayload => {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired token");
  }
};

export const getUserFromToken = async (token: string): Promise<User> => {
  const payload = verifyToken(token);

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  if (!user.isActive) {
    throw new UnauthorizedError("Account disabled");
  }

  return user;
};

export type AuthContext = {
  user: User;
};

const extractTokenFromRequest = (req: Request): string => {
  const authorization = req.headers.get("authorization") ?? req.headers.get("Authorization");

  if (!authorization) {
    throw new UnauthorizedError("Missing Authorization header");
  }

  const parts = authorization.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new UnauthorizedError("Malformed Authorization header");
  }

  return parts[1];
};

export const requireAuth = async (
  req: Request,
  allowedRoles?: Role[],
): Promise<AuthContext> => {
  const token = extractTokenFromRequest(req);
  const user = await getUserFromToken(token);

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    throw new UnauthorizedError("Insufficient permissions");
  }

  return { user };
};
