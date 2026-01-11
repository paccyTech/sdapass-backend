import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { paramsSchemaMiddleware } from "@/middlewares/params.middleware";
import { getMemberPassController } from "@/controllers/member.controller";

const paramsSchema = z.object({
  memberId: z.string().min(1, "Member id is required"),
});

export const GET = createHandler({
  middlewares: [
    requireAuthMiddleware(["CHURCH_ADMIN", "DISTRICT_ADMIN", "UNION_ADMIN", "MEMBER"]),
    paramsSchemaMiddleware(paramsSchema),
  ],
  controller: getMemberPassController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
