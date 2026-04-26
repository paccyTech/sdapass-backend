import { parseISO } from "date-fns";

import type {
  AuthenticatedBodyContext,
  AuthenticatedBodyParamsContext,
  AuthenticatedQueryContext,
} from "@/middlewares/types";
import {
  checkInToUmugandaEvent,
  createUmugandaEvent,
  deleteUmugandaEvent,
  getUmugandaEventForUser,
  listFilteredUmugandaEventsForUser,
  listUmugandaEventAttendanceForUser,
  listUmugandaEventsForUser,
  updateUmugandaEvent,
  type CheckInToUmugandaEventInput,
  type CreateUmugandaEventInput,
  type UmugandaEventFilters,
  type UpdateUmugandaEventInput,
} from "@/services/umugandaEvent.service";
import { ValidationError } from "@/lib/errors";
import { recordAuditLog } from "@/services/audit-log.service";

export const listUmugandaEventsController = async (context: AuthenticatedQueryContext<any>) => {
  const events = await listUmugandaEventsForUser(context.user);
  return { events };
};

export type CreateUmugandaEventBody = {
  date: string;
  theme?: string | null;
  location?: string | null;
};

export const createUmugandaEventController = async (
  context: AuthenticatedBodyContext<CreateUmugandaEventBody>,
) => {
  if (!context.body) {
    throw new ValidationError("Missing request body");
  }

  const date = parseISO(context.body.date);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError("Invalid event date");
  }

  const input: CreateUmugandaEventInput = {
    date,
    theme: context.body.theme,
    location: context.body.location,
  };

  const event = await createUmugandaEvent(context.user, input);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "umuganda_event.create",
    details: {
      eventId: event.id,
      unionId: event.unionId,
      date: event.date.toISOString(),
    },
  });

  return { event };
};

export const getUmugandaEventController = async (
  context: AuthenticatedBodyParamsContext<never, UmugandaEventParams>,
) => {
  const event = await getUmugandaEventForUser(context.user, context.paramsData.eventId);
  return { event };
};

export type UpdateUmugandaEventBody = {
  date?: string;
  theme?: string | null;
  location?: string | null;
};

export const updateUmugandaEventController = async (
  context: AuthenticatedBodyParamsContext<UpdateUmugandaEventBody, UmugandaEventParams>,
) => {
  if (!context.body) {
    throw new ValidationError("Missing request body");
  }

  let parsedDate: Date | undefined;
  if (typeof context.body.date === "string") {
    const date = parseISO(context.body.date);
    if (Number.isNaN(date.getTime())) {
      throw new ValidationError("Invalid event date");
    }
    parsedDate = date;
  }

  const input: UpdateUmugandaEventInput = {
    date: parsedDate,
    theme: context.body.theme,
    location: context.body.location,
  };

  const event = await updateUmugandaEvent(context.user, context.paramsData.eventId, input);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "umuganda_event.update",
    details: {
      eventId: event.id,
      unionId: event.unionId,
    },
  });

  return { event };
};

export const deleteUmugandaEventController = async (
  context: AuthenticatedBodyParamsContext<never, UmugandaEventParams>,
) => {
  const result = await deleteUmugandaEvent(context.user, context.paramsData.eventId);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "umuganda_event.delete",
    details: {
      eventId: context.paramsData.eventId,
    },
  });

  return result;
};

export type UmugandaEventParams = {
  eventId: string;
};

export type CheckInBody = {
  token: string;
};

export const checkInToUmugandaEventController = async (
  context: AuthenticatedBodyParamsContext<CheckInBody, UmugandaEventParams>,
) => {
  if (!context.body) {
    throw new ValidationError("Missing request body");
  }

  const input: CheckInToUmugandaEventInput = {
    eventId: context.paramsData.eventId,
    token: context.body.token,
  };

  const attendance = await checkInToUmugandaEvent(context.user, input);

  await recordAuditLog({
    req: context.req,
    user: context.user,
    action: "umuganda_event.check_in",
    details: {
      eventId: input.eventId,
      attendanceId: Array.isArray(attendance) ? attendance[0]?.id : (attendance as any).id,
      memberId: Array.isArray(attendance) ? attendance[0]?.memberId : (attendance as any).memberId,
      churchId: Array.isArray(attendance) ? attendance[0]?.churchId : (attendance as any).churchId,
    },
  });

  return { attendance };
};

export type UmugandaAttendanceQuery = {
  churchId?: string;
};

export const listUmugandaEventAttendanceController = async (
  context: AuthenticatedQueryContext<UmugandaAttendanceQuery> & { paramsData: UmugandaEventParams },
) => {
  const attendance = await listUmugandaEventAttendanceForUser(context.user, context.paramsData.eventId, {
    churchId: context.queryData.churchId,
  });

  return { attendance };
};

export type UmugandaEventFiltersQuery = {
  search?: string;
  churchIds?: string;
  dateFrom?: string;
  dateTo?: string;
  attendanceMin?: string;
  attendanceMax?: string;
  theme?: string;
  location?: string;
  eventStatus?: 'all' | 'upcoming' | 'past';
};

export const listFilteredUmugandaEventsController = async (
  context: AuthenticatedQueryContext<UmugandaEventFiltersQuery>,
) => {
  const filters: UmugandaEventFilters = {};

  if (context.queryData.search) filters.search = context.queryData.search;
  if (context.queryData.churchIds) {
    filters.churchIds = context.queryData.churchIds.split(',').filter(Boolean);
  }
  if (context.queryData.dateFrom) {
    const date = new Date(context.queryData.dateFrom);
    if (!Number.isNaN(date.getTime())) {
      filters.dateFrom = date;
    }
  }
  if (context.queryData.dateTo) {
    const date = new Date(context.queryData.dateTo);
    if (!Number.isNaN(date.getTime())) {
      filters.dateTo = date;
    }
  }
  if (context.queryData.attendanceMin) {
    const min = parseInt(context.queryData.attendanceMin);
    if (!Number.isNaN(min)) {
      filters.attendanceMin = min;
    }
  }
  if (context.queryData.attendanceMax) {
    const max = parseInt(context.queryData.attendanceMax);
    if (!Number.isNaN(max)) {
      filters.attendanceMax = max;
    }
  }
  if (context.queryData.theme) filters.theme = context.queryData.theme;
  if (context.queryData.location) filters.location = context.queryData.location;
  if (context.queryData.eventStatus) filters.eventStatus = context.queryData.eventStatus;

  const events = await listFilteredUmugandaEventsForUser(context.user, filters);
  return { events };
};
