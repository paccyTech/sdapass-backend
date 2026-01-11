import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import {
  createChurchAdminController,
  listChurchAdminsController,
} from "@/controllers/churchAdmin.controller";

const filtersSchema = z.object({
  districtId: z.string().optional(),
  churchId: z.string().optional(),
});

const createSchema = z.object({
  churchId: z.string().min(1, "Church is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(6, "Phone number is required"),
  email: z.string().email("Valid email is required"),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN"]),
    querySchemaMiddleware(filtersSchema),
  ],
  controller: listChurchAdminsController,
});

export const POST = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN"]),
    jsonBodyMiddleware(createSchema),
  ],
  controller: createChurchAdminController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
