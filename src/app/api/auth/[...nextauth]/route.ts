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
