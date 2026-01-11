import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import { districtAccessMiddleware } from "@/middlewares/access.middleware";
import {
  createChurchController,
  listChurchesController,
} from "@/controllers/church.controller";

const churchQuerySchema = z.object({
  districtId: z.string().optional(),
});

const createChurchSchema = z.object({
  districtId: z.string().min(1, "District is required"),
  name: z.string().min(1, "Name is required"),
  location: z.string().optional().nullable(),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"]),
    querySchemaMiddleware(churchQuerySchema),
    districtAccessMiddleware({ optional: true }),
  ],
  controller: listChurchesController,
});

export const POST = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN"]),
    jsonBodyMiddleware(createChurchSchema),
    districtAccessMiddleware({ key: "districtId" }),
  ],
  controller: createChurchController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
