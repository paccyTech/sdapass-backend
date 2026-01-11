import { z } from "zod";

import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import type { Middleware } from "@/middlewares/types";

const reportQuerySchema = z.object({
  districtId: z.string().optional(),
  churchId: z.string().optional(),
  sessionId: z.string().optional(),
  status: z.enum(["PENDING", "APPROVED"]).optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  groupBy: z.enum(["church", "district"]).optional(),
});

export const reportQueryMiddleware = querySchemaMiddleware(reportQuerySchema);

export const reportAuthMiddleware: Middleware = requireAuthMiddleware([
  "UNION_ADMIN",
  "DISTRICT_ADMIN",
  "CHURCH_ADMIN",
  "POLICE_VERIFIER",
]);
