import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import {
  createDistrictController,
  listDistrictsController,
} from "@/controllers/district.controller";

const districtQuerySchema = z.object({
  unionId: z.string().optional(),
});

const createDistrictSchema = z.object({
  unionId: z.string().min(1, "Union is required"),
  name: z.string().min(1, "Name is required"),
  location: z.string().optional().nullable(),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN"]),
    querySchemaMiddleware(districtQuerySchema),
  ],
  controller: listDistrictsController,
});

export const POST = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN"]),
    jsonBodyMiddleware(createDistrictSchema),
  ],
  controller: createDistrictController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
