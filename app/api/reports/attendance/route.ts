import { createHandler } from "@/lib/route";
import { getAttendanceReportController } from "@/controllers/report.controller";
import { reportAuthMiddleware, reportQueryMiddleware } from "@/middlewares/report.middleware";

export const GET = createHandler({
  middlewares: [reportAuthMiddleware, reportQueryMiddleware],
  controller: getAttendanceReportController,
});
