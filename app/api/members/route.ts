import { NextResponse } from "next/server";
import { z } from "zod";
import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { querySchemaMiddleware } from "@/middlewares/query.middleware";
import {
  createMemberController,
  listMembersController,
} from "@/controllers/member.controller";

const memberQuerySchema = z.object({
  districtId: z.string().optional(),
  churchId: z.string().optional(),
});

const createMemberSchema = z.object({
  nationalId: z.string().min(1, "National ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email().optional(),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN", "DISTRICT_ADMIN", "CHURCH_ADMIN"]),
    querySchemaMiddleware(memberQuerySchema),
  ],
  controller: listMembersController,
});

export const POST = createHandler({
  middlewares: [
    requireAuthMiddleware(["CHURCH_ADMIN"]),
    jsonBodyMiddleware(createMemberSchema),
  ],
  controller: createMemberController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
