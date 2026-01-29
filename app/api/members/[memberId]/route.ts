import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import {
  deleteMemberController,
  updateMemberController,
} from "@/controllers/member.controller";
import { paramsSchemaMiddleware } from "@/middlewares/params.middleware";

const updateMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

const memberParamsSchema = z.object({
  memberId: z.string().min(1, "Member id is required"),
});

export const PATCH = createHandler({
  middlewares: [
    requireAuthMiddleware(["CHURCH_ADMIN"]),
    paramsSchemaMiddleware(memberParamsSchema),
    jsonBodyMiddleware(updateMemberSchema.partial({})),
  ],
  controller: updateMemberController,
});

export const DELETE = createHandler({
  middlewares: [requireAuthMiddleware(["CHURCH_ADMIN"]), paramsSchemaMiddleware(memberParamsSchema)],
  controller: deleteMemberController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
