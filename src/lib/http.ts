import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AppError, isAppError, ValidationError } from "@/lib/errors";
import { env } from "@/lib/env";

interface HandlerFn<ReturnType> {
  (): Promise<ReturnType>;
}

export const jsonResponse = <T>(data: T, init?: ResponseInit) => {
  return NextResponse.json(data, init);
};

export const handleRequest = async <T>(req: Request, handler: HandlerFn<T>) => {
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return applyCors(response, req);
  }

  try {
    const data = await handler();
    let response: NextResponse;
    
    if (data instanceof NextResponse) {
      response = data;
    } else {
      response = jsonResponse({ data });
    }
    
    // Ensure CORS is applied to successful responses
    return applyCors(response, req);
  } catch (err) {
    const error = err as unknown;
    let response: NextResponse;

    if (error instanceof ZodError) {
      const validationError = new ValidationError("Validation failed", error.flatten());
      response = NextResponse.json(
        {
          error: validationError.message,
          details: validationError.details,
        },
        { status: validationError.status },
      );
    } else if (isAppError(error)) {
      response = NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.status },
      );
    } else if (error instanceof Error) {
      console.error(error);
      response = NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    } else {
      console.error("Unknown error", error);
      response = NextResponse.json(
        { error: 'Internal Server Error' },
        { status: 500 },
      );
    }
    
    // Ensure CORS is applied to error responses
    return applyCors(response, req);
  }
};

const stripQuotes = (origin: string) => origin.replace(/^"|"$/g, "").replace(/^'|'$/g, "");

const normalizeOrigin = (origin: string) => stripQuotes(origin).replace(/\/$/, "");

const parseAllowedOrigins = () => {
  if (!env.CORS_ORIGIN) {
    return [] as string[];
  }

  return env.CORS_ORIGIN.split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => normalizeOrigin(value));
};

const applyCors = (response: NextResponse, request?: Request) => {
  const allowedOrigins = parseAllowedOrigins();

  if (!allowedOrigins.length) {
    return response;
  }

  const requestOriginHeader = request?.headers.get("origin") ?? null;
  const requestOrigin = requestOriginHeader ? normalizeOrigin(requestOriginHeader) : null;

  if (process.env.NODE_ENV !== "production") {
    console.log("[cors] request origin:", requestOrigin, "allowed origins:", allowedOrigins);
  }

  let allowOrigin: string | null = null;

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    allowOrigin = requestOrigin;
  } else if (requestOrigin && allowedOrigins.includes("*")) {
    allowOrigin = requestOrigin;
  } else if (allowedOrigins.length === 1) {
    allowOrigin = allowedOrigins[0];
  }

  if (!allowOrigin && allowedOrigins.length) {
    allowOrigin = allowedOrigins[0];
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[cors] resolved allowOrigin:", allowOrigin);
  }

  if (!allowOrigin) {
    return response;
  }

  response.headers.set("Access-Control-Allow-Origin", allowOrigin);

  if (process.env.NODE_ENV !== "production") {
    console.log("[cors] setting Access-Control-Allow-Origin=", allowOrigin);
  }
  const requestedHeaders = request?.headers.get("access-control-request-headers");

  response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.headers.set(
    "Access-Control-Allow-Headers",
    requestedHeaders && requestedHeaders.length
      ? requestedHeaders
      : "Content-Type,Authorization,Accept",
  );
  response.headers.set("Access-Control-Allow-Credentials", "true");
  response.headers.set("Access-Control-Max-Age", "600");
  response.headers.set("Vary", "Origin");

  return response;
};
