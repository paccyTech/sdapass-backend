import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { confirmPasswordResetController } from "@/controllers/passwordReset.controller";

const confirmSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const POST = createHandler({
  middlewares: [jsonBodyMiddleware(confirmSchema)],
  controller: confirmPasswordResetController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
