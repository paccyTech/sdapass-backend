import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { getMeController, updateMeController } from "@/controllers/user.controller";

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  phoneNumber: z.string().min(1).optional(),
});

export const GET = createHandler({
  middlewares: [requireAuthMiddleware()],
  controller: getMeController,
});

export const PATCH = createHandler({
  middlewares: [requireAuthMiddleware(), jsonBodyMiddleware(updateSchema)],
  controller: updateMeController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
