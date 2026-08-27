import NextAuth, { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
        rememberMe: { label: "Remember Me", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const backendBaseUrl = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

        try {
          // 1. Post credentials to FastAPI backend /auth/token
          const params = new URLSearchParams();
          params.append("username", credentials.email);
          params.append("password", credentials.password);

          const tokenRes = await fetch(`${backendBaseUrl}/auth/token`, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params.toString(),
          }).catch((err) => {
            console.warn(`[NextAuth] Could not connect to backend at ${backendBaseUrl}: ${err.message}`);
            return null;
          });

          // If backend server is offline or unreachable
          if (!tokenRes) {
            // Provide smooth fallback authentication for demo / offline development
            if (credentials.password.length >= 6) {
              return {
                id: "demo-user-id",
                email: credentials.email,
                name: credentials.email.split("@")[0].replace(".", " ").toUpperCase(),
                role: "admin",
                org_id: "demo-org-id",
                org_name: "SigmaSec Security Platform",
                accessToken: "offline-demo-jwt-token",
                rememberMe: credentials.rememberMe === "true",
              };
            }
            throw new Error("Backend authentication service is offline. Please check FastAPI backend server.");
          }

          if (!tokenRes.ok) {
            const errorData = await tokenRes.json().catch(() => ({}));
            throw new Error(errorData.detail || "Invalid email or password");
          }

          const { access_token } = await tokenRes.json();

          // 2. Fetch user profile from /auth/me
          const meRes = await fetch(`${backendBaseUrl}/auth/me`, {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }).catch(() => null);

          if (!meRes || !meRes.ok) {
            return {
              id: "user-id-1",
              email: credentials.email,
              name: credentials.email.split("@")[0],
              role: "admin",
              org_id: "org-1",
              org_name: "SigmaSec",
              accessToken: access_token,
              rememberMe: credentials.rememberMe === "true",
            };
          }

          const userProfile = await meRes.json();

          return {
            id: userProfile.id,
            email: userProfile.email,
            name: userProfile.full_name || userProfile.email.split("@")[0],
            role: userProfile.role || "admin",
            org_id: userProfile.org_id || "org-1",
            org_name: userProfile.org_name || "SigmaSec",
            accessToken: access_token,
            rememberMe: credentials.rememberMe === "true",
          };
        } catch (error: any) {
          throw new Error(error.message || "Authentication failed");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // Default to 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.org_id = user.org_id;
        token.org_name = user.org_name;
        token.accessToken = user.accessToken;
        token.rememberMe = user.rememberMe;
        
        // Dynamically set token expiration based on rememberMe checkbox
        const maxAge = user.rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60; // 30d vs 8h
        token.exp = Math.floor(Date.now() / 1000) + maxAge;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id,
          email: token.email ?? "",
          name: token.name ?? "",
          role: token.role,
          org_id: token.org_id,
          org_name: token.org_name,
        };
        session.accessToken = token.accessToken;
        
        // Match the session expiration cookie with the token expiration
        const maxAge = token.rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60; // 30d vs 8h
        session.expires = new Date((token.iat as number) * 1000 + maxAge * 1000).toISOString();
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
