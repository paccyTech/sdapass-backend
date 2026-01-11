import type { BodyContext } from "@/middlewares/types";
import {
  confirmPasswordReset,
  requestPasswordReset,
  type PasswordResetConfirmInput,
  type PasswordResetRequestInput,
} from "@/services/passwordReset.service";

export const requestPasswordResetController = async (
  context: BodyContext<PasswordResetRequestInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const result = await requestPasswordReset(context.body);
  return result;
};

export const confirmPasswordResetController = async (
  context: BodyContext<PasswordResetConfirmInput>,
) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const result = await confirmPasswordReset(context.body);
  return result;
};
