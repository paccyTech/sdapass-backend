import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user?: {
      id: string;
      role: Role;
      unionId?: string | null;
      districtId?: string | null;
      churchId?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    unionId?: string | null;
    districtId?: string | null;
    churchId?: string | null;
  }
}
