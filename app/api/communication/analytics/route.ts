import { createHandler } from "@/lib/route";
import { authMiddleware } from "@/middlewares/auth.middleware";
import { getChurchCommunicationAnalyticsController } from "@/controllers/communication.controller";

export const GET = createHandler({
  middlewares: [authMiddleware],
  controller: getChurchCommunicationAnalyticsController,
});
