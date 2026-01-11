import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import { listAuditLogsController } from "@/controllers/audit-log.controller";

const auditLogQuerySchema = z.object({
  action: z.string().optional(),
  role: z.enum(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN", "MEMBER", "POLICE_VERIFIER"]).optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN"]),
    querySchemaMiddleware(auditLogQuerySchema),
  ],
  controller: listAuditLogsController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
