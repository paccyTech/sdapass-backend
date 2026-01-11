import { handleRequest } from "@/lib/http";
import type {
  ControllerAction,
  Middleware,
  MiddlewareContext,
  RouteParams,
} from "@/middlewares/types";

interface CreateHandlerOptions<
  TResult,
  TContext extends MiddlewareContext = MiddlewareContext,
> {
  middlewares?: Middleware[];
  controller: ControllerAction<TResult, TContext>;
}

export const createHandler = <
  TResult,
  TContext extends MiddlewareContext = MiddlewareContext,
>({ middlewares = [], controller }: CreateHandlerOptions<TResult, TContext>) => {
  return async (req: Request, ctx?: { params?: RouteParams }) => {
    return handleRequest(req, async () => {
      const url = new URL(req.url);
      let context: MiddlewareContext = {
        req,
        params: ctx?.params ?? {},
        query: url.searchParams,
      };

      for (const middleware of middlewares) {
        context = await middleware(context);
      }

      return controller({ ...context, params: context.params } as TContext);
    });
  };
};
