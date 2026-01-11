import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import {
  deleteMemberController,
  updateMemberController,
} from "@/controllers/member.controller";

const updateMemberSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phoneNumber: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export const PATCH = createHandler({
  middlewares: [
    requireAuthMiddleware(["CHURCH_ADMIN"]),
    jsonBodyMiddleware(updateMemberSchema.partial({})),
  ],
  controller: updateMemberController,
});

export const DELETE = createHandler({
  middlewares: [requireAuthMiddleware(["CHURCH_ADMIN"])],
  controller: deleteMemberController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
