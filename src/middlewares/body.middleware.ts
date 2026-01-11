import { ZodError, type ZodTypeAny } from "zod";

import { ValidationError } from "@/lib/errors";
import type { BodyContext, Middleware, MiddlewareContext } from "@/middlewares/types";

export const jsonBodyMiddleware = <
  TSchema extends ZodTypeAny,
  TInput extends MiddlewareContext = MiddlewareContext,
>(
  schema: TSchema,
): Middleware<TInput, TInput & BodyContext<ReturnType<TSchema["parse"]>>> => {
  return async (context) => {
    let rawBody: unknown;

    try {
      rawBody = await context.req.json();
    } catch (error) {
      if (schema.isOptional()) {
        rawBody = undefined;
      } else {
        throw new ValidationError("Invalid JSON body");
      }
    }

    try {
      const parsed = schema.parse(rawBody);
      return {
        ...context,
        body: parsed,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError("Validation failed", error.flatten());
      }
      throw error;
    }
  };
};
