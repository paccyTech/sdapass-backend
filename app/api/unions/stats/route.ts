import { NextResponse } from "next/server";

import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { getUnionStatsController } from "@/controllers/union.controller";

export const GET = createHandler({
  middlewares: [requireAuthMiddleware(["UNION_ADMIN"])],
  controller: getUnionStatsController,
});

export const OPTIONS = createHandler({
  controller: async () => new NextResponse(null, { status: 204 }),
});
