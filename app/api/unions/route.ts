import { NextResponse } from "next/server";
import { z } from "zod";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { jsonBodyMiddleware } from "@/middlewares/body.middleware";
import { listUnionsController, createUnionController } from "@/controllers/union.controller";

const createUnionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
});

export const GET = createHandler({
  middlewares: [requireAuthMiddleware(["UNION_ADMIN"])],
  controller: listUnionsController,
});

export const POST = createHandler({
  middlewares: [
    requireAuthMiddleware(["UNION_ADMIN"]),
    jsonBodyMiddleware(createUnionSchema),
  ],
  controller: createUnionController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
