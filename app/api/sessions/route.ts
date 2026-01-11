import { z } from "zod";
import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import { churchAccessMiddleware, districtAccessMiddleware } from "@/middlewares/access.middleware";
import {
  createSessionController,
  listSessionsController,
} from "@/controllers/session.controller";

const sessionQuerySchema = z.object({
  districtId: z.string().optional(),
  churchId: z.string().optional(),
});

const createSessionSchema = z.object({
  date: z.string().min(1, "Date is required"),
  theme: z.string().optional().nullable(),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"]),
    querySchemaMiddleware(sessionQuerySchema),
    districtAccessMiddleware({ optional: true }),
    churchAccessMiddleware({ optional: true }),
  ],
  controller: listSessionsController,
});

export const POST = createHandler({
  middlewares: [
    requireAuthMiddleware(["CHURCH_ADMIN"]),
    jsonBodyMiddleware(createSessionSchema),
    churchAccessMiddleware({ key: "churchId", optional: true }),
  ],
  controller: createSessionController,
});
