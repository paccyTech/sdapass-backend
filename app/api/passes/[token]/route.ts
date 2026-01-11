import { NextResponse } from "next/server";
import { z } from "zod";

import { handleRequest } from "@/lib/http";
import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { paramsSchemaMiddleware } from "@/middlewares/params.middleware";
import { verifyPassController } from "@/controllers/pass.controller";

const paramsSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export const GET = createHandler({
  middlewares: [
    paramsSchemaMiddleware(paramsSchema),
    requireAuthMiddleware(["POLICE_VERIFIER"]),
  ],
  controller: verifyPassController,
});

export const OPTIONS = (request: Request) => {
  return handleRequest(request, async () => new NextResponse(null, { status: 204 }));
};
