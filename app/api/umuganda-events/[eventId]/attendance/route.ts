import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { paramsSchemaMiddleware } from "@/middlewares/params.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import {
  checkInToUmugandaEventController,
  listUmugandaEventAttendanceController,
} from "@/controllers/umugandaEvent.controller";

const paramsSchema = z.object({
  eventId: z.string().min(1, "Event is required"),
});

const bodySchema = z.object({
  token: z.string().min(1, "Token is required"),
});

const querySchema = z.object({
  churchId: z.string().min(1).optional(),
});

export const GET = createHandler({
  middlewares: [
    paramsSchemaMiddleware(paramsSchema),
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"]),
    querySchemaMiddleware(querySchema),
  ],
  controller: listUmugandaEventAttendanceController,
});

export const POST = createHandler({
  middlewares: [
    paramsSchemaMiddleware(paramsSchema),
    requireAuthMiddleware(["CHURCH_ADMIN"]),
    jsonBodyMiddleware(bodySchema),
  ],
  controller: checkInToUmugandaEventController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
