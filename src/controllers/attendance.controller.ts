import type {
  AuthenticatedBodyContext,
  AuthenticatedBodyParamsContext,
  AuthenticatedQueryContext,
} from "@/middlewares/types";
import {
  createAttendance,
  listAttendanceForUser,
  updateAttendance,
  type AttendanceFilters,
  type CreateAttendanceInput,
  type UpdateAttendanceInput,
} from "@/services/attendance.service";

export const listAttendanceController = async (
  context: AuthenticatedQueryContext<Partial<AttendanceFilters>>,
) => {
  const attendance = await listAttendanceForUser(context.user, context.queryData ?? {});
  return { attendance };
};

export const createAttendanceController = async (
  context: AuthenticatedBodyContext<CreateAttendanceInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const attendance = await createAttendance(context.user, context.body);
  return { attendance };
};

export type UpdateAttendanceParams = {
  attendanceId: string;
};

export const updateAttendanceController = async (
  context: AuthenticatedBodyParamsContext<UpdateAttendanceInput, UpdateAttendanceParams>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const { attendance, pass } = await updateAttendance(
    context.user,
    context.paramsData.attendanceId,
    context.body,
  );

  return pass ? { attendance, pass } : { attendance };
};
