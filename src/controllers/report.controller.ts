import type { AuthenticatedQueryContext } from "@/middlewares/types";
import {
  getAttendanceBreakdownByChurch,
  getAttendanceBreakdownByDistrict,
  getAttendanceSummaryForUser,
  type AttendanceSummaryFilters,
} from "@/services/report.service";

export type AttendanceReportQuery = {
  districtId?: string;
  churchId?: string;
  sessionId?: string;
  status?: "PENDING" | "APPROVED";
  fromDate?: string;
  toDate?: string;
  groupBy?: "church" | "district";
};

const buildFiltersFromQuery = (query: AttendanceReportQuery): AttendanceSummaryFilters => {
  const filters: AttendanceSummaryFilters = {};

  if (query.districtId) {
    filters.districtId = query.districtId;
  }

  if (query.churchId) {
    filters.churchId = query.churchId;
  }

  if (query.sessionId) {
    filters.sessionId = query.sessionId;
  }

  if (query.status) {
    filters.status = query.status;
  }

  if (query.fromDate) {
    filters.fromDate = query.fromDate;
  }

  if (query.toDate) {
    filters.toDate = query.toDate;
  }

  return filters;
};

export const getAttendanceReportController = async (
  context: AuthenticatedQueryContext<AttendanceReportQuery>,
) => {
  const query = context.queryData ?? {};
  const filters = buildFiltersFromQuery(query);

  const summary = await getAttendanceSummaryForUser(context.user, filters);

  if (query.groupBy === "church") {
    const breakdown = await getAttendanceBreakdownByChurch(context.user, filters);
    return {
      summary,
      breakdown: {
        groupBy: "church" as const,
        data: breakdown,
      },
    };
  }

  if (query.groupBy === "district") {
    const breakdown = await getAttendanceBreakdownByDistrict(context.user, filters);
    return {
      summary,
      breakdown: {
        groupBy: "district" as const,
        data: breakdown,
      },
    };
  }

  return { summary };
};
