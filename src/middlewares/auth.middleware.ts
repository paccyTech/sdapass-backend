import type { Role } from "@prisma/client";

import { UnauthorizedError } from "@/lib/errors";
import { getUserFromToken } from "@/services/auth.service";

import type { AuthenticatedContext, Middleware, MiddlewareContext } from "./types";

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

export const requireAuthMiddleware = (
  allowedRoles?: Role[],
): Middleware<MiddlewareContext, AuthenticatedContext> => {
  return async (context) => {
    const token = extractTokenFromRequest(context.req);
    const user = await getUserFromToken(token);

    if (allowedRoles && !allowedRoles.includes(user.role)) {
      throw new UnauthorizedError("Insufficient permissions");
    }

    return {
      ...context,
      user,
    } satisfies AuthenticatedContext;
  };
};

export const optionalAuthMiddleware: Middleware = async (context) => {
  try {
    const authorization = context.req.headers.get("authorization") ?? context.req.headers.get("Authorization");
    if (!authorization) {
      return context;
    }

    const token = extractTokenFromRequest(context.req);
    const user = await getUserFromToken(token);

    return {
      ...context,
      user,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return context;
    }

    throw error;
  }
};
