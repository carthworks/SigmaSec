import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      role: string;
      org_id: string;
      org_name?: string;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    org_id: string;
    org_name?: string;
    accessToken: string;
    rememberMe: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    org_id: string;
    org_name?: string;
    accessToken: string;
    rememberMe: boolean;
  }
}

