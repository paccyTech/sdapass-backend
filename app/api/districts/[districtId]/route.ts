import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import {
  deleteDistrictController,
  getDistrictController,
  updateDistrictController,
} from "@/controllers/district.controller";
import { districtAccessMiddleware } from "@/middlewares/access.middleware";

const updateDistrictSchema = z.object({
  unionId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  location: z.string().optional().nullable(),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN"]),
    districtAccessMiddleware({ key: "districtId" }),
  ],
  controller: getDistrictController,
});

export const PATCH = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN"]),
    jsonBodyMiddleware(updateDistrictSchema.partial({})),
  ],
  controller: updateDistrictController,
});

export const DELETE = createHandler({
  middlewares: [requireAuthMiddleware(["UNION_ADMIN"])],
  controller: deleteDistrictController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
