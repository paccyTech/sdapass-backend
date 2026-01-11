import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import {
  assignChurchesToPastorController,
  deleteDistrictPastorController,
  updateDistrictPastorController,
} from "@/controllers/districtPastor.controller";

const updateDistrictPastorSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().min(6).optional(),
  email: z.string().email().optional(),
  districtId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
});

const assignChurchesSchema = z.object({
  churchIds: z.array(z.string().min(1)),
});

export const PATCH = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN"]),
    jsonBodyMiddleware(updateDistrictPastorSchema.partial({})),
  ],
  controller: updateDistrictPastorController,
});

export const PUT = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN"]),
    jsonBodyMiddleware(assignChurchesSchema),
  ],
  controller: assignChurchesToPastorController,
});

export const DELETE = createHandler({
  middlewares: [requireAuthMiddleware(["UNION_ADMIN"])],
  controller: deleteDistrictPastorController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
