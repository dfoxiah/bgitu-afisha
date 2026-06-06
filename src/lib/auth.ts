/**
 * File responsibility:
 * NextAuth configuration and callbacks for credentials/OAuth authentication.
 *
 * Main logic:
 * - Configure providers, JWT/session callbacks and secure redirects
 * - Enrich tokens/sessions with app-specific profile/notification fields
 * - Write audit trail events for sign-in/sign-out/user creation
 *
 * Integrations:
 * - src/app/api/auth/* routes
 * - Prisma User model
 * - src/lib/audit.ts
 */
import type { NextAuthOptions, User } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import YandexProvider from "next-auth/providers/yandex";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { EventCategory, Role } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";

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
const yandexClientId = process.env.YANDEX_CLIENT_ID ?? "";
const yandexClientSecret = process.env.YANDEX_CLIENT_SECRET ?? "";
const maxClientId = process.env.MAX_CLIENT_ID ?? "";
const maxClientSecret = process.env.MAX_CLIENT_SECRET ?? "";
const maxAuthorizationUrl = process.env.MAX_AUTHORIZATION_URL ?? "";
const maxTokenUrl = process.env.MAX_TOKEN_URL ?? "";
const maxUserInfoUrl = process.env.MAX_USERINFO_URL ?? "";
const maxScope = process.env.MAX_SCOPE || "openid profile email";

const toSyntheticProviderEmail = (provider: string, providerAccountId: string | number) =>
  `${provider}-${providerAccountId}@oauth.local`.toLowerCase()

const readProfileString = (profile: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = profile[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number") return String(value)
  }
  return ""
}

type MaxOAuthProfile = Record<string, unknown>

const maxProvider =
  maxClientId && maxClientSecret && maxAuthorizationUrl && maxTokenUrl && maxUserInfoUrl
    ? ({
        id: "max",
        name: "MAX",
        type: "oauth",
        clientId: maxClientId,
        clientSecret: maxClientSecret,
        authorization: {
          url: maxAuthorizationUrl,
          params: {
            scope: maxScope,
          },
        },
        token: maxTokenUrl,
        userinfo: maxUserInfoUrl,
        profile(profile: MaxOAuthProfile) {
          const providerId =
            readProfileString(profile, ["sub", "id", "user_id", "uid"]) ||
            readProfileString(profile, ["email", "login"])
          const email =
            readProfileString(profile, ["email", "default_email"]) ||
            toSyntheticProviderEmail("max", providerId || "unknown")
          const name =
            readProfileString(profile, ["name", "display_name", "username", "login"]) ||
            [readProfileString(profile, ["first_name", "given_name"]), readProfileString(profile, ["last_name", "family_name"])]
              .filter(Boolean)
              .join(" ") ||
            null
          const image = readProfileString(profile, ["picture", "avatar", "avatar_url", "photo"])

          return {
            id: providerId || email,
            name,
            email,
            image: image || null,
            role: Role.STUDENT,
          }
        },
      } satisfies OAuthConfig<MaxOAuthProfile>)
    : null

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
      admissionYear?: number | null;
      groupChangeCount?: number;
      bio?: string | null;
      notifyNewEvents?: boolean;
      notifyChanges?: boolean;
      notifyNews?: boolean;
      notificationCategories?: EventCategory[];
      notifyInApp?: boolean;
      notifyEmail?: boolean;
      notifyVk?: boolean;
      vkUserId?: string | null;
      yandexEmail?: string | null;
      privacyConsentAt?: Date | null;
      privacyConsentVersion?: string | null;
      termsConsentAt?: Date | null;
      termsConsentVersion?: string | null;
      profileCompletedAt?: Date | null;
    };
  }

  interface User {
    role: Role;
    department?: string | null;
    group?: string | null;
    admissionYear?: number | null;
    groupChangeCount?: number;
    privacyConsentAt?: Date | null;
    termsConsentAt?: Date | null;
    bio?: string | null;
    notifyNewEvents?: boolean;
    notifyChanges?: boolean;
    notifyNews?: boolean;
    notifyInApp?: boolean;
    notifyEmail?: boolean;
    notifyVk?: boolean;
    vkUserId?: string | null;
    yandexEmail?: string | null;
    privacyConsentVersion?: string | null;
    termsConsentVersion?: string | null;
    profileCompletedAt?: Date | null;
    notificationCategories?: EventCategory[];
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
    admissionYear?: number | null;
    picture?: string | null;
    groupChangeCount?: number;
    bio?: string | null;
    notifyNewEvents?: boolean;
    notifyChanges?: boolean;
    notifyNews?: boolean;
    notifyInApp?: boolean;
    notifyEmail?: boolean;
    notifyVk?: boolean;
    vkUserId?: string | null;
    yandexEmail?: string | null;
    privacyConsentAt?: string | null;
    privacyConsentVersion?: string | null;
    termsConsentAt?: string | null;
    termsConsentVersion?: string | null;
    profileCompletedAt?: string | null;
    notificationCategories?: EventCategory[];
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
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials): Promise<User | null> {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            return null;
          }

          if (!user.password) {
            return null;
          }

          const isValid = await bcrypt.compare(credentials.password, user.password);

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            image: user.image,
            department: user.department,
            group: user.group,
            admissionYear: user.admissionYear,
            notifyNewEvents: user.notifyNewEvents ?? true,
            notifyChanges: user.notifyChanges ?? true,
            notifyNews: user.notifyNews ?? false,
            notificationCategories: user.notificationCategories ?? [],
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
    ...(yandexClientId && yandexClientSecret
      ? [
          YandexProvider({
            clientId: yandexClientId,
            clientSecret: yandexClientSecret,
            authorization: {
              params: {
                scope: process.env.YANDEX_SCOPE || "login:email login:info",
              },
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
                email:
                  profile.default_email ||
                  (Array.isArray(profile.emails) && profile.emails[0]) ||
                  toSyntheticProviderEmail("yandex", profile.id),
                image: avatar,
                role: Role.STUDENT,
              };
            },
          }),
        ]
      : []),
    ...(maxProvider ? [maxProvider] : []),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider && user?.id) {
        const updates: Record<string, unknown> = {}
        if (account.provider === "yandex" && user.email && !user.email.endsWith("@oauth.local")) {
          updates.yandexEmail = user.email
        }

        if (Object.keys(updates).length > 0) {
          await prisma.user.update({ where: { id: user.id }, data: updates }).catch(() => undefined)
        }
      }
      return true;
    },

    async jwt({ token, user, account: _account, trigger, session }) {
      // При первом входе добавляем данные пользователя в токен.
      if (user) {
        token.id = user.id;
        token.email = user.email ?? "";
        token.role = user.role ?? Role.STUDENT;
        token.department = user.department;
        token.group = user.group;
        token.admissionYear = user.admissionYear;
        token.name = user.name;
        token.picture = user.image;
        token.groupChangeCount = user.groupChangeCount ?? 0;
        token.bio = user.bio;
        token.notifyNewEvents = user.notifyNewEvents ?? true;
        token.notifyChanges = user.notifyChanges ?? true;
        token.notifyNews = user.notifyNews ?? false;
        token.notifyInApp = user.notifyInApp ?? true;
        token.notifyEmail = user.notifyEmail ?? false;
        token.notifyVk = user.notifyVk ?? false;
        token.vkUserId = user.vkUserId ?? null;
        token.yandexEmail = user.yandexEmail ?? null;
        token.privacyConsentAt = user.privacyConsentAt ? user.privacyConsentAt.toISOString() : null;
        token.privacyConsentVersion = user.privacyConsentVersion ?? null;
        token.termsConsentAt = user.termsConsentAt ? user.termsConsentAt.toISOString() : null;
        token.termsConsentVersion = user.termsConsentVersion ?? null;
        token.profileCompletedAt = user.profileCompletedAt ? user.profileCompletedAt.toISOString() : null;
        token.notificationCategories = user.notificationCategories ?? [];
      }

      // При client-side update() синхронизируем измененные поля с токеном.
      if (trigger === "update" && session?.user) {
        token.name = session.user.name;
        token.picture = session.user.image;
        token.department = session.user.department;
        token.group = session.user.group;
        token.admissionYear = session.user.admissionYear;
        token.groupChangeCount = session.user.groupChangeCount ?? token.groupChangeCount ?? 0;
        token.bio = session.user.bio;
        token.notifyNewEvents = session.user.notifyNewEvents ?? token.notifyNewEvents ?? true;
        token.notifyChanges = session.user.notifyChanges ?? token.notifyChanges ?? true;
        token.notifyNews = session.user.notifyNews ?? token.notifyNews ?? false;
        token.notifyInApp = session.user.notifyInApp ?? token.notifyInApp ?? true;
        token.notifyEmail = session.user.notifyEmail ?? token.notifyEmail ?? false;
        token.notifyVk = session.user.notifyVk ?? token.notifyVk ?? false;
        token.vkUserId = session.user.vkUserId ?? token.vkUserId ?? null;
        token.yandexEmail = session.user.yandexEmail ?? token.yandexEmail ?? null;
        token.privacyConsentAt = session.user.privacyConsentAt
          ? session.user.privacyConsentAt.toISOString()
          : token.privacyConsentAt ?? null;
        token.privacyConsentVersion =
          session.user.privacyConsentVersion ?? token.privacyConsentVersion ?? null;
        token.termsConsentAt = session.user.termsConsentAt
          ? session.user.termsConsentAt.toISOString()
          : token.termsConsentAt ?? null;
        token.termsConsentVersion = session.user.termsConsentVersion ?? token.termsConsentVersion ?? null;
        token.profileCompletedAt = session.user.profileCompletedAt
          ? session.user.profileCompletedAt.toISOString()
          : token.profileCompletedAt ?? null;
        token.notificationCategories = session.user.notificationCategories ?? token.notificationCategories ?? [];
      }

      return token;
    },

    async session({ session, token }) {
      const tokenId = typeof token.id === "string" ? token.id : null;
      const tokenEmail = typeof token.email === "string" ? token.email : null;

      if (tokenId || tokenEmail) {
        const existingUser = await prisma.user.findUnique({
          where: tokenId ? { id: tokenId } : { email: tokenEmail! },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            department: true,
            group: true,
            admissionYear: true,
            groupChangeCount: true,
            bio: true,
            notifyNewEvents: true,
            notifyChanges: true,
            notifyNews: true,
            notifyInApp: true,
            notifyEmail: true,
            notifyVk: true,
            notificationCategories: true,
            vkUserId: true,
            yandexEmail: true,
            privacyConsentAt: true,
            privacyConsentVersion: true,
            termsConsentAt: true,
            termsConsentVersion: true,
            profileCompletedAt: true,
          },
        });

        if (!existingUser) {
          return null as unknown as typeof session;
        }

        token.id = existingUser.id
        token.email = existingUser.email
        token.name = existingUser.name
        token.picture = existingUser.image
        token.role = existingUser.role
        token.department = existingUser.department
        token.group = existingUser.group
        token.admissionYear = existingUser.admissionYear
        token.groupChangeCount = existingUser.groupChangeCount
        token.bio = existingUser.bio
        token.notifyNewEvents = existingUser.notifyNewEvents
        token.notifyChanges = existingUser.notifyChanges
        token.notifyNews = existingUser.notifyNews
        token.notifyInApp = existingUser.notifyInApp
        token.notifyEmail = existingUser.notifyEmail
        token.notifyVk = existingUser.notifyVk
        token.notificationCategories = existingUser.notificationCategories
        token.vkUserId = existingUser.vkUserId
        token.yandexEmail = existingUser.yandexEmail
        token.privacyConsentAt = existingUser.privacyConsentAt?.toISOString() ?? null
        token.privacyConsentVersion = existingUser.privacyConsentVersion
        token.termsConsentAt = existingUser.termsConsentAt?.toISOString() ?? null
        token.termsConsentVersion = existingUser.termsConsentVersion
        token.profileCompletedAt = existingUser.profileCompletedAt?.toISOString() ?? null
      } else {
        return null as unknown as typeof session;
      }

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
        session.user.admissionYear =
          typeof token.admissionYear === "number" ? token.admissionYear : null;
        session.user.name = typeof token.name === "string" ? token.name : null;
        session.user.image = typeof token.picture === "string" ? token.picture : null;
        session.user.groupChangeCount =
          typeof token.groupChangeCount === "number" ? token.groupChangeCount : 0;
        session.user.bio = typeof token.bio === "string" ? token.bio : null;
        session.user.notifyNewEvents =
          typeof token.notifyNewEvents === "boolean" ? token.notifyNewEvents : true;
        session.user.notifyChanges =
          typeof token.notifyChanges === "boolean" ? token.notifyChanges : true;
        session.user.notifyNews =
          typeof token.notifyNews === "boolean" ? token.notifyNews : false;
        session.user.notifyInApp =
          typeof token.notifyInApp === "boolean" ? token.notifyInApp : true;
        session.user.notifyEmail =
          typeof token.notifyEmail === "boolean" ? token.notifyEmail : false;
        session.user.notifyVk =
          typeof token.notifyVk === "boolean" ? token.notifyVk : false;
        session.user.vkUserId = typeof token.vkUserId === "string" ? token.vkUserId : null;
        session.user.yandexEmail = typeof token.yandexEmail === "string" ? token.yandexEmail : null;
        session.user.privacyConsentAt =
          typeof token.privacyConsentAt === "string" ? new Date(token.privacyConsentAt) : null;
        session.user.privacyConsentVersion =
          typeof token.privacyConsentVersion === "string" ? token.privacyConsentVersion : null;
        session.user.termsConsentAt =
          typeof token.termsConsentAt === "string" ? new Date(token.termsConsentAt) : null;
        session.user.termsConsentVersion =
          typeof token.termsConsentVersion === "string" ? token.termsConsentVersion : null;
        session.user.profileCompletedAt =
          typeof token.profileCompletedAt === "string" ? new Date(token.profileCompletedAt) : null;
        session.user.notificationCategories = Array.isArray(token.notificationCategories)
          ? (token.notificationCategories as EventCategory[])
          : [];
      }

      return session;
    },

    async redirect({ url, baseUrl }) {
      // Разрешаем только безопасные redirect внутри приложения.
      if (url.startsWith(baseUrl)) return url;
      // Разрешаем относительные URL внутри приложения.
      if (url.startsWith("/")) return new URL(url, baseUrl).toString();
      return baseUrl;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
    signOut: "/",
    newUser: "/profile/complete",
  },
  secret: nextAuthSecret || "development-secret-key-change-in-production",
  events: {
    async signIn({ user, account, isNewUser }) {
      await logAuditEvent({
        actorId: user.id,
        action: "AUTH_SIGN_IN",
        entityType: "User",
        entityId: user.id,
        metadata: { provider: account?.provider, isNewUser: !!isNewUser },
      });
    },
    async signOut({ session }) {
      if (session?.user?.id) {
        await logAuditEvent({
          actorId: session.user.id,
          action: "AUTH_SIGN_OUT",
          entityType: "User",
          entityId: session.user.id,
        });
      }
    },
    async createUser({ user }) {
      await logAuditEvent({
        actorId: user.id,
        action: "AUTH_CREATE_USER",
        entityType: "User",
        entityId: user.id,
      });
    },
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
        // Domain задаем только в проде для реального домена.
        // domain: process.env.NODE_ENV === "production" ? ".your-domain.ru" : undefined,
      },
    },
  },
};
