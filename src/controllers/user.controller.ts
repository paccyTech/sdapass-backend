import type { AuthenticatedBodyContext, AuthenticatedContext } from "@/middlewares/types";

import { updateMe, type UpdateMeInput } from "@/services/user.service";

const toSafeUser = (user: { passwordHash?: string } & Record<string, unknown>) => {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
};

export const getMeController = async (context: AuthenticatedContext) => {
  return {
    user: toSafeUser(context.user),
  };
};

export const updateMeController = async (context: AuthenticatedBodyContext<UpdateMeInput>) => {
  if (!context.body) {
    throw new Error("Missing request body");
  }

  const updated = await updateMe(context.user, context.body);

  return {
    user: toSafeUser(updated),
  };
};
