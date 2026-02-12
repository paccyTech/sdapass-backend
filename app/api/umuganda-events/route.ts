import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { listUmugandaEventsController, createUmugandaEventController } from "@/controllers/umugandaEvent.controller";

const createUmugandaEventSchema = z.object({
  date: z.string().min(1, "Date is required"),
  theme: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

export const GET = createHandler({
  middlewares: [requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"])],
  controller: listUmugandaEventsController,
});

export const POST = createHandler({
  middlewares: [requireAuthMiddleware(["UNION_ADMIN"]), jsonBodyMiddleware(createUmugandaEventSchema)],
  controller: createUmugandaEventController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
