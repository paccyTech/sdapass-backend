import { ZodError, type ZodTypeAny } from "zod";

import { ValidationError } from "@/lib/errors";
import type { Middleware, MiddlewareContext, ParamsContext } from "@/middlewares/types";

export const paramsSchemaMiddleware = <
  TSchema extends ZodTypeAny,
  TInput extends MiddlewareContext = MiddlewareContext,
>(
  schema: TSchema,
): Middleware<TInput, TInput & ParamsContext<ReturnType<TSchema["parse"]>>> => {
  return async (context) => {
    try {
      const parsed = schema.parse(context.params);
      return {
        ...context,
        paramsData: parsed,
      };
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError("Invalid route parameters", error.flatten());
      }

      throw error;
    }
  };
};
