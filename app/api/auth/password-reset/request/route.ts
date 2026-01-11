import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { requestPasswordResetController } from "@/controllers/passwordReset.controller";

const requestSchema = z
  .object({
    nationalId: z.string().min(1).optional(),
    email: z.string().email().optional(),
  })
  .refine((data) => Boolean(data.email || data.nationalId), {
    message: "Provide either email or nationalId",
    path: ["email"],
  });

export const POST = createHandler({
  middlewares: [jsonBodyMiddleware(requestSchema)],
  controller: requestPasswordResetController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
