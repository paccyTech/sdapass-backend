import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import {
  createDistrictPastorController,
  listDistrictPastorsController,
} from "@/controllers/districtPastor.controller";

const districtPastorQuerySchema = z.object({
  districtId: z.string().optional(),
});

const createDistrictPastorSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(6),
  email: z.string().email(),
  districtId: z.string().min(1),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN"]),
    querySchemaMiddleware(districtPastorQuerySchema),
  ],
  controller: listDistrictPastorsController,
});

export const POST = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN"]),
    jsonBodyMiddleware(createDistrictPastorSchema),
  ],
  controller: createDistrictPastorController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
