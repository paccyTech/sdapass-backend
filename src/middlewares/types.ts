import type { User } from "@prisma/client";

import type { DistrictEntity } from "@/models/district.model";
import type { ChurchEntity } from "@/models/church.model";
import type { SessionEntity } from "@/models/session.model";

export interface RouteParams {
  [key: string]: string | string[];
}

export interface MiddlewareContext {
  req: Request;
  params: RouteParams;
  query: URLSearchParams;
  user?: User;
  body?: unknown;
  [key: string]: unknown;
}

export interface AuthenticatedContext extends MiddlewareContext {
  user: User;
}

export interface BodyContext<TBody> extends MiddlewareContext {
  body: TBody;
}

export type AuthenticatedBodyContext<TBody> = AuthenticatedContext & BodyContext<TBody>;

export interface QueryContext<TQuery> extends MiddlewareContext {
  queryData: TQuery;
}

export interface ParamsContext<TParams> extends MiddlewareContext {
  paramsData: TParams;
}

export type AuthenticatedQueryContext<TQuery> = AuthenticatedContext & QueryContext<TQuery>;
export type AuthenticatedParamsContext<TParams> = AuthenticatedContext & ParamsContext<TParams>;
export type AuthenticatedBodyQueryContext<TBody, TQuery> = AuthenticatedContext &
  BodyContext<TBody> &
  QueryContext<TQuery>;
export type AuthenticatedBodyParamsContext<TBody, TParams> = AuthenticatedContext &
  BodyContext<TBody> &
  ParamsContext<TParams>;

export interface DistrictAccessContext extends AuthenticatedContext {
  district?: DistrictEntity;
}

export interface ChurchAccessContext extends AuthenticatedContext {
  church?: ChurchEntity;
}

export interface SessionAccessContext extends AuthenticatedContext {
  session?: SessionEntity;
}

export type Middleware<
  TInput extends MiddlewareContext = MiddlewareContext,
  TOutput extends MiddlewareContext = TInput,
> = (context: TInput) => Promise<TOutput>;

export type ControllerAction<
  TResult = unknown,
  TContext extends MiddlewareContext = MiddlewareContext,
> = (context: TContext) => Promise<TResult>;
