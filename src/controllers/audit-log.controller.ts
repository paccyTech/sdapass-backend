import type { AuthenticatedContext } from "@/middlewares/types";
import {
  listAuditLogsForUnionAdmin,
  type AuditLogFilters,
} from "@/services/audit-log.service";

export const listAuditLogsController = async (
  context: AuthenticatedContext & { queryData?: Partial<AuditLogFilters> },
) => {
  const filters: AuditLogFilters = {
    action: context.queryData?.action,
    role: context.queryData?.role,
    search: context.queryData?.search,
    cursor: context.queryData?.cursor,
    limit: context.queryData?.limit ? Number(context.queryData.limit) : undefined,
  };

  const result = await listAuditLogsForUnionAdmin(context.user, filters);
  return result;
};
