import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { churchAccessMiddleware } from "@/middlewares/access.middleware";
import {
  deleteChurchController,
  getChurchController,
  updateChurchController,
} from "@/controllers/church.controller";

const updateChurchSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
  districtId: z.string().min(1).optional(),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"]),
    churchAccessMiddleware({ key: "churchId" }),
  ],
  controller: getChurchController,
});

export const PATCH = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"]),
    jsonBodyMiddleware(updateChurchSchema.partial({})),
    churchAccessMiddleware({ key: "churchId" }),
  ],
  controller: updateChurchController,
});

export const DELETE = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN"]),
    churchAccessMiddleware({ key: "churchId" }),
  ],
  controller: deleteChurchController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
