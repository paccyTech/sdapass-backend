import type { BodyContext } from "@/middlewares/types";
import { authenticateWithCredentials } from "@/services/auth.service";
import { recordAuditLog } from "@/services/audit-log.service";

export type LoginRequestBody = {
  email?: string;
  phoneNumber?: string;
  password: string;
};

export const loginController = async (context: BodyContext<LoginRequestBody>) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const { email, phoneNumber, password } = context.body;

  const { token, user } = await authenticateWithCredentials({
    email,
    phoneNumber,
    password,
  });

  await recordAuditLog({
    req: context.req,
    user,
    action: "auth.login",
    details: {
      via: email ? "email" : "phoneNumber",
    },
  });

  return {
    token,
    user,
  };
};
