import { z } from "zod";

import { NextResponse } from "next/server";

import { createHandler } from "@/lib/route";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { loginController } from "@/controllers/auth.controller";

const loginSchema = z
  .object({
    email: z.string().email("Valid email is required").optional(),
    nationalId: z.string().min(1, "National ID is required").optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => Boolean(data.email || data.nationalId), {
    message: "Email or national ID is required",
    path: ["email"],
  })
  .refine((data) => !(data.email && data.nationalId), {
    message: "Provide either email or national ID, not both",
    path: ["email"],
  });

export const POST = createHandler({
  middlewares: [jsonBodyMiddleware(loginSchema)],
  controller: loginController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
