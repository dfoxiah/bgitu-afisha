import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import YandexProvider from "next-auth/providers/yandex";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";

const authLog = (...args: any[]) => {
  if (process.env.DEBUG_AUTH === "true") {
    console.log(...args);
  }
};

const isProduction = process.env.NODE_ENV === "production";

const requireEnv = (name: string) => {
  const value = process.env[name];
  if (!value && isProduction) {
    throw new Error(`${name} is required in production.`);
  }
  return value ?? "";
};

const nextAuthSecret = requireEnv("NEXTAUTH_SECRET");
const nextAuthUrl = process.env.NEXTAUTH_URL ?? "";
if (isProduction && !nextAuthUrl) {
  throw new Error("NEXTAUTH_URL is required in production.");
}
const googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
const yandexClientId = process.env.YANDEX_CLIENT_ID ?? "";
const yandexClientSecret = process.env.YANDEX_CLIENT_SECRET ?? "";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      image?: string | null;
      department?: string | null;
      group?: string | null;
      groupChangeCount?: number;
      bio?: string | null;
    };
  }
  
  interface User {
    role: Role;
    department?: string | null;
    group?: string | null;
    groupChangeCount?: number;
    privacyConsentAt?: Date | null;
    termsConsentAt?: Date | null;
    bio?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    email: string;
    role: Role;
    name?: string | null;
    department?: string | null;
    group?: string | null;
    picture?: string | null;
    groupChangeCount?: number;
    bio?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          authLog("Missing credentials");
          return null;
        }

        try {
          authLog("Auth attempt for:", credentials.email);
          
          const user = await prisma.user.findUnique({
            where: { email: credentials.email }
          });

          if (!user) {
            authLog("User not found:", credentials.email);
            return null;
          }

          if (!user.password) {
            authLog("User has no password (OAuth user)");
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);

          if (!isValid) {
            authLog("Invalid password for:", credentials.email);
            return null;
          }

          authLog("User authenticated successfully:", user.email);
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image,
            department: user.department,
            group: user.group,
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
      
    }),
    ...(googleClientId && googleClientSecret
      ? [
          GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          }),
        ]
      : []),
    ...(yandexClientId && yandexClientSecret
      ? [
          YandexProvider({
            clientId: yandexClientId,
            clientSecret: yandexClientSecret,
            authorization: {
              params: {
                scope: process.env.YANDEX_SCOPE || "login:email login:info"
              }
            },
            profile(profile) {
              const name =
                profile.real_name ||
                profile.display_name ||
                [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
                profile.login;

              const avatar = profile.default_avatar_id
                ? `https://avatars.yandex.net/get-yapic/${profile.default_avatar_id}/islands-200`
                : null;

              return {
                id: profile.id,
                name: name || null,
                email: profile.default_email || null,
                image: avatar,
                role: Role.STUDENT
              };
            }
          }),
        ]
      : []),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 дней
  },
  callbacks: {
    async signIn({ user }) {
      authLog("Sign in callback:", user.email);
      return true;
    },
    
    async jwt({ token, user, trigger, session }) {
      // При первом входе добавляем данные пользователя в токен
      if (user) {
        token.id = user.id;
        token.email = user.email ?? "";
        token.role = user.role ?? Role.STUDENT;
        token.department = user.department;
        token.group = user.group;
        token.name = user.name;
        token.picture = user.image;
        token.groupChangeCount = user.groupChangeCount ?? 0;
        token.bio = user.bio;
      }
      
      // При обновлении сессии
      if (trigger === "update" && session?.user) {
        token.name = session.user.name;
        token.picture = session.user.image;
        token.department = session.user.department;
        token.group = session.user.group;
        token.groupChangeCount = session.user.groupChangeCount ?? token.groupChangeCount ?? 0;
        token.bio = session.user.bio;
      }
      
      return token;
    },
    
    async session({ session, token }) {
      if (token && session.user) {
        if (typeof token.id === "string") {
          session.user.id = token.id;
        }
        if (typeof token.email === "string") {
          session.user.email = token.email;
        }
        session.user.role = (token.role as Role) ?? Role.STUDENT;
        session.user.department = typeof token.department === "string" ? token.department : null;
        session.user.group = typeof token.group === "string" ? token.group : null;
        session.user.name = typeof token.name === "string" ? token.name : null;
        session.user.image = typeof token.picture === "string" ? token.picture : null;
        session.user.groupChangeCount =
          typeof token.groupChangeCount === "number" ? token.groupChangeCount : 0;
        session.user.bio = typeof token.bio === "string" ? token.bio : null;
      }
      
      authLog("Session callback:", session.user.email);
      return session;
    },
    
    async redirect({ url, baseUrl }) {
      // Разрешаем только безопасные redirect-и внутри приложения
      if (url.startsWith(baseUrl)) return url;
      // Разрешаем относительные URL внутри приложения
      if (url.startsWith("/")) return new URL(url, baseUrl).toString();
      return baseUrl;
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/",
    newUser: "/register"
  },
  secret: nextAuthSecret || "development-secret-key-change-in-production",
  debug: process.env.NEXTAUTH_DEBUG === "true",
  events: {
    async signIn({ user, account, isNewUser }) {
      authLog("User signed in:", user.email);
      await logAuditEvent({
        actorId: user.id,
        action: "AUTH_SIGN_IN",
        entityType: "User",
        entityId: user.id,
        metadata: { provider: account?.provider, isNewUser: !!isNewUser }
      });
    },
    async signOut({ session }) {
      authLog("User signed out");
      if (session?.user?.id) {
        await logAuditEvent({
          actorId: session.user.id,
          action: "AUTH_SIGN_OUT",
          entityType: "User",
          entityId: session.user.id
        });
      }
    },
    async createUser({ user }) {
      authLog("New user created:", user.email);
      await logAuditEvent({
        actorId: user.id,
        action: "AUTH_CREATE_USER",
        entityType: "User",
        entityId: user.id
      });
    }
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // Domain задаем только в проде для реального домена
        // domain: process.env.NODE_ENV === "production" ? ".your-domain.ru" : undefined,
      }
    }
  },
};
