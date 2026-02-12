import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { paramsSchemaMiddleware } from "@/middlewares/params.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import {
  deleteUmugandaEventController,
  getUmugandaEventController,
  updateUmugandaEventController,
} from "@/controllers/umugandaEvent.controller";

const paramsSchema = z.object({
  eventId: z.string().min(1, "Event is required"),
});

const updateSchema = z.object({
  date: z.string().min(1).optional(),
  theme: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

export const GET = createHandler({
  middlewares: [
    paramsSchemaMiddleware(paramsSchema),
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"]),
  ],
  controller: getUmugandaEventController,
});

export const PATCH = createHandler({
  middlewares: [
    paramsSchemaMiddleware(paramsSchema),
    requireAuthMiddleware(["UNION_ADMIN"]),
    jsonBodyMiddleware(updateSchema.partial({})),
  ],
  controller: updateUmugandaEventController,
});

export const DELETE = createHandler({
  middlewares: [
    paramsSchemaMiddleware(paramsSchema),
    requireAuthMiddleware(["UNION_ADMIN"]),
  ],
  controller: deleteUmugandaEventController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
