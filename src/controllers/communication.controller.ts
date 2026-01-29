import type { AuthenticatedQueryContext } from "@/middlewares/types";
import { getChurchCommunicationAnalytics } from "@/services/communication.service";

export type CommunicationAnalyticsQuery = {
  fromDate?: string;
  toDate?: string;
};

export const getChurchCommunicationAnalyticsController = async (
  context: AuthenticatedQueryContext<CommunicationAnalyticsQuery>
) => {
  const { fromDate, toDate } = context.queryData || {};
  
  const analytics = await getChurchCommunicationAnalytics(
    context.user,
    {
      fromDate,
      toDate,
    }
  );

  return analytics;
};
