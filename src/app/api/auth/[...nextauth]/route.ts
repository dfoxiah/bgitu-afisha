/**
 * File responsibility:
 * HTTP route handler for this App Router API endpoint.
 *
 * Main logic:
 * - Validate request/session input.
 * - Execute route-specific workflow and return JSON response.
 *
 * Integrations:
 * - src/server/* domain services
 * - Prisma and shared helpers
 */
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth({
  ...authOptions,
  callbacks: {
    ...authOptions.callbacks,
    async signIn({ user }) {
      if (process.env.DEBUG_AUTH === "true") {
        console.log("API Route - Sign in:", user.email);
      }
      return true;
    }
  }
});

export { handler as GET, handler as POST };
