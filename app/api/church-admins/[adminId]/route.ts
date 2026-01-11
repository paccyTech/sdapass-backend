import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { churchAccessMiddleware } from "@/middlewares/access.middleware";
import { paramsSchemaMiddleware } from "@/middlewares/params.middleware";
import {
  deleteChurchAdminController,
  updateChurchAdminController,
} from "@/controllers/churchAdmin.controller";

const adminIdParamsSchema = z.object({
  adminId: z.string().min(1),
});

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().min(6).optional(),
  email: z.string().email().optional(),
  churchId: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN"]),
    paramsSchemaMiddleware(adminIdParamsSchema),
    jsonBodyMiddleware(updateSchema.partial({})),
    churchAccessMiddleware({ key: "churchId", optional: true }),
  ],
  controller: updateChurchAdminController,
});

export const DELETE = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN"]),
    paramsSchemaMiddleware(adminIdParamsSchema),
  ],
  controller: deleteChurchAdminController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
