import { ZodError, type ZodTypeAny } from "zod";

import { ValidationError } from "@/lib/errors";
import type { Middleware, MiddlewareContext, QueryContext } from "@/middlewares/types";

export const querySchemaMiddleware = <
  TSchema extends ZodTypeAny,
  TInput extends MiddlewareContext = MiddlewareContext,
>(
  schema: TSchema,
): Middleware<TInput, TInput & QueryContext<ReturnType<TSchema["parse"]>>> => {
  return async (context) => {
    const queryObject = Object.fromEntries(context.query.entries());
    try {
      const parsed = schema.parse(queryObject);
      return {
        ...context,
        queryData: parsed,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError("Invalid query parameters", error.flatten());
      }

      throw error;
    }
  };
};
