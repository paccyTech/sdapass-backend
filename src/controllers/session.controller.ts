import { parseISO } from "date-fns";
import type {
  AuthenticatedBodyContext,
  AuthenticatedQueryContext,
} from "@/middlewares/types";
import {
  createSession,
  listSessionsForUser,
  type CreateSessionInput,
  type SessionFilters,
} from "@/services/session.service";
import { ValidationError } from "@/lib/errors";

export type CreateSessionBody = {
  date: string;
  theme?: string | null;
};

export const listSessionsController = async (
  context: AuthenticatedQueryContext<Partial<SessionFilters>>,
) => {
  const sessions = await listSessionsForUser(context.user, context.queryData ?? {});
  return { sessions };
};

export const createSessionController = async (
  context: AuthenticatedBodyContext<CreateSessionBody>,
) => {
  if (!context.body) {
    throw new ValidationError("Missing request body");
  }

  const date = parseISO(context.body.date);

  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid session date");
  }

  const payload: CreateSessionInput = {
    date,
    theme: context.body.theme,
  };

  const session = await createSession(context.user, payload);
  return { session };
};
