import { NextResponse } from "next/server";

import { createHandler } from "@/lib/route";
import { getAttendanceReportController } from "@/controllers/report.controller";
import { reportAuthMiddleware, reportQueryMiddleware } from "@/middlewares/report.middleware";
import { applyCors } from "@/lib/http";

export const GET = createHandler({
  middlewares: [reportAuthMiddleware, reportQueryMiddleware],
  controller: getAttendanceReportController,
});

export const OPTIONS = async (req: Request) => {
  const response = new NextResponse(null, { status: 204 });
  return applyCors(response, req);
};
