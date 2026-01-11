import type { AuthenticatedParamsContext } from "@/middlewares/types";
import { verifyPassToken } from "@/services/pass.service";

export interface VerifyPassParams {
  token: string;
}

export const verifyPassController = async (
  context: AuthenticatedParamsContext<VerifyPassParams>,
) => {
  const token = context.paramsData.token;
  const result = await verifyPassToken(token);
  return result;
};
