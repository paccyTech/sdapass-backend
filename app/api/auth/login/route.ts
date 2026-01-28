import { z } from "zod";

import { NextResponse } from "next/server";

import { createHandler } from "@/lib/route";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { loginController } from "@/controllers/auth.controller";

const loginSchema = z
  .object({
    email: z.string().email("Valid email is required").optional(),
    phoneNumber: z.string().min(1, "Phone number is required").optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => Boolean(data.email || data.phoneNumber), {
    message: "Email or phone number is required",
    path: ["email"],
  })
  .refine((data) => !(data.email && data.phoneNumber), {
    message: "Provide either email or phone number, not both",
    path: ["email"],
  });

export const POST = createHandler({
  middlewares: [jsonBodyMiddleware(loginSchema)],
  controller: loginController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
