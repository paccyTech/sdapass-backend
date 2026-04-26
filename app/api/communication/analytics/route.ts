import { createHandler } from "@/lib/route";
import { requireAuthMiddleware } from "@/middlewares/auth.middleware";
import { getChurchCommunicationAnalyticsController } from "@/controllers/communication.controller";

export const GET = createHandler({
  middlewares: [requireAuthMiddleware()],
  controller: getChurchCommunicationAnalyticsController,
});
