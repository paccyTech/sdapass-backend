import { ensureChurchAccess, ensureDistrictAccess, ensureSessionAccess } from "@/lib/access";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import type {
  AuthenticatedContext,
  ChurchAccessContext,
  DistrictAccessContext,
  Middleware,
  MiddlewareContext,
  SessionAccessContext,
} from "@/middlewares/types";

type AccessMiddlewareOptions = {
  key?: string;
  optional?: boolean;
};

const extractIdentifier = (context: MiddlewareContext, key: string): string | undefined => {
  const fromParamsData =
    "paramsData" in context && context.paramsData && typeof context.paramsData === "object"
      ? (context.paramsData as Record<string, unknown>)[key]
      : undefined;

  const fromParams = context.params?.[key];

  const fromQuery =
    "queryData" in context && context.queryData && typeof context.queryData === "object"
      ? (context.queryData as Record<string, unknown>)[key]
      : undefined;

  const fromBody =
    "body" in context && context.body && typeof context.body === "object"
      ? (context.body as Record<string, unknown>)[key]
      : undefined;

  const value = fromParamsData ?? fromParams ?? fromQuery ?? fromBody;

  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const resolveIdentifier = (
  context: MiddlewareContext,
  key: string,
  { optional }: AccessMiddlewareOptions = {},
): string | undefined => {
  const id = extractIdentifier(context, key);

  if (!id && !optional) {
    throw new ValidationError(`Missing or invalid identifier for ${key}`);
  }

  return id;
};

export const districtAccessMiddleware = (
  options: AccessMiddlewareOptions = {},
): Middleware<MiddlewareContext, MiddlewareContext & DistrictAccessContext> => {
  const key = options.key ?? "districtId";
  const optional = options.optional ?? false;

  return async (context) => {
    if (!context.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const districtId = resolveIdentifier(context, key, { optional });

    if (!districtId) {
      return {
        ...context,
        district: (context as DistrictAccessContext).district,
      } satisfies MiddlewareContext & DistrictAccessContext;
    }

    const district = await ensureDistrictAccess(context.user, districtId);

    return {
      ...context,
      district,
    } satisfies MiddlewareContext & DistrictAccessContext;
  };
};

export const churchAccessMiddleware = (
  options: AccessMiddlewareOptions = {},
): Middleware<MiddlewareContext, MiddlewareContext & ChurchAccessContext> => {
  const key = options.key ?? "churchId";
  const optional = options.optional ?? false;

  return async (context) => {
    if (!context.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const churchId = resolveIdentifier(context, key, { optional });

    if (!churchId) {
      return {
        ...context,
        church: (context as ChurchAccessContext).church,
      } satisfies MiddlewareContext & ChurchAccessContext;
    }

    const church = await ensureChurchAccess(context.user, churchId);

    return {
      ...context,
      church,
    } satisfies MiddlewareContext & ChurchAccessContext;
  };
};

export const sessionAccessMiddleware = (
  options: AccessMiddlewareOptions = {},
): Middleware<MiddlewareContext, MiddlewareContext & SessionAccessContext> => {
  const key = options.key ?? "sessionId";
  const optional = options.optional ?? false;

  return async (context) => {
    if (!context.user) {
      throw new UnauthorizedError("Authentication required");
    }

    const sessionId = resolveIdentifier(context, key, { optional });

    if (!sessionId) {
      return {
        ...context,
        session: (context as SessionAccessContext).session,
      } satisfies MiddlewareContext & SessionAccessContext;
    }

    const session = await ensureSessionAccess(context.user, sessionId);

    return {
      ...context,
      session,
    } satisfies MiddlewareContext & SessionAccessContext;
  };
};
