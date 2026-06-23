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
import VKProvider, { type VkProfile } from "next-auth/providers/vk";
import YandexProvider from "next-auth/providers/yandex";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { EventCategory, Role } from "@prisma/client";
import { logAuditEvent } from "@/lib/audit";
import { asPrismaUserCompat, type UserWithTelegram } from "@/lib/prisma-user-compat"
import { buildEmailInsensitiveFilter, normalizeEmailAddress } from "@/server/shared/user-email";
import { normalizeVkRecipient } from "@/lib/vk";
import { getTelegramUserIdFromLoginCompleteIdentifier, TELEGRAM_LOGIN_COMPLETE_PREFIX } from "@/lib/telegram"

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
const useSecureAuthCookies = /^https:\/\//i.test(nextAuthUrl)
const yandexClientId = process.env.YANDEX_CLIENT_ID ?? "";
const yandexClientSecret = process.env.YANDEX_CLIENT_SECRET ?? "";
const vkClientId = process.env.VK_CLIENT_ID ?? "";
const vkClientSecret = process.env.VK_CLIENT_SECRET ?? "";
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN ?? ""
const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME ?? ""
const maxClientId = process.env.MAX_CLIENT_ID ?? "";
const maxClientSecret = process.env.MAX_CLIENT_SECRET ?? "";
const maxAuthorizationUrl = process.env.MAX_AUTHORIZATION_URL ?? "";
const maxTokenUrl = process.env.MAX_TOKEN_URL ?? "";
const maxUserInfoUrl = process.env.MAX_USERINFO_URL ?? "";
const maxScope = process.env.MAX_SCOPE || "openid profile email";
const prismaUser = asPrismaUserCompat(prisma.user)

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

const toRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null

const toNullableString = (value: unknown) => {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return null
}

const getVkProfileUser = (profile: unknown) => {
  const record = toRecord(profile)
  const response = record?.response
  if (!Array.isArray(response) || response.length === 0) return null
  return toRecord(response[0])
}

type MaxOAuthProfile = Record<string, unknown>
type OAuthAccountLike = {
  provider?: string | null
  providerAccountId?: string | number | null
} | null

type TelegramAuthPayload = {
  id: string
  first_name: string
  last_name: string | null
  username: string | null
  photo_url: string | null
  auth_date: number
  hash: string
}

type TelegramBotLoginPayload = {
  loginToken: string
}

type SessionUserRecord = Pick<
  UserWithTelegram,
  | "id"
  | "email"
  | "name"
  | "image"
  | "role"
  | "isScenarioPersona"
  | "scenarioOwnerId"
  | "department"
  | "group"
  | "admissionYear"
  | "groupChangeCount"
  | "bio"
  | "notifyNewEvents"
  | "notifyChanges"
  | "notifyNews"
  | "notifyInApp"
  | "notifyEmail"
  | "notifyVk"
  | "notifyTelegram"
  | "notificationCategories"
  | "vkUserId"
  | "telegramChatId"
  | "telegramUsername"
  | "yandexEmail"
  | "privacyConsentAt"
  | "privacyConsentVersion"
  | "termsConsentAt"
  | "termsConsentVersion"
  | "profileCompletedAt"
>

type ImpersonationUpdatePayload =
  | { action: "start"; targetUserId: string }
  | { action: "stop" }

const readImpersonationUpdatePayload = (value: unknown): ImpersonationUpdatePayload | null => {
  if (!value || typeof value !== "object") return null

  const payload = value as Record<string, unknown>
  const actionValue = payload.action
  if (actionValue === "stop") {
    return { action: "stop" }
  }

  const targetUserIdValue = payload.targetUserId
  const targetUserId = typeof targetUserIdValue === "string" ? targetUserIdValue.trim() : ""

  if (actionValue === "start" && targetUserId) {
    return { action: "start", targetUserId }
  }

  return null
}

const selectSessionUserRecord = {
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  isScenarioPersona: true,
  scenarioOwnerId: true,
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
  notifyTelegram: true,
  notificationCategories: true,
  vkUserId: true,
  telegramChatId: true,
  telegramUsername: true,
  yandexEmail: true,
  privacyConsentAt: true,
  privacyConsentVersion: true,
  termsConsentAt: true,
  termsConsentVersion: true,
  profileCompletedAt: true,
} as const

const applyUserRecordToToken = (
  token: Record<string, unknown>,
  user: Pick<
    SessionUserRecord,
    | "id"
    | "email"
    | "name"
    | "image"
    | "role"
    | "isScenarioPersona"
    | "scenarioOwnerId"
    | "department"
    | "group"
    | "admissionYear"
    | "groupChangeCount"
    | "bio"
    | "notifyNewEvents"
    | "notifyChanges"
    | "notifyNews"
    | "notifyInApp"
    | "notifyEmail"
    | "notifyVk"
    | "notifyTelegram"
    | "notificationCategories"
    | "vkUserId"
    | "telegramChatId"
    | "telegramUsername"
    | "yandexEmail"
    | "privacyConsentAt"
    | "privacyConsentVersion"
    | "termsConsentAt"
    | "termsConsentVersion"
    | "profileCompletedAt"
  >
) => {
  token.id = user.id
  token.email = user.email
  token.name = user.name
  token.picture = user.image
  token.role = user.role
  token.isScenarioPersona = user.isScenarioPersona
  token.scenarioOwnerId = user.scenarioOwnerId
  token.department = user.department
  token.group = user.group
  token.admissionYear = user.admissionYear
  token.groupChangeCount = user.groupChangeCount ?? 0
  token.bio = user.bio
  token.notifyNewEvents = user.notifyNewEvents ?? true
  token.notifyChanges = user.notifyChanges ?? true
  token.notifyNews = user.notifyNews ?? false
  token.notifyInApp = user.notifyInApp ?? true
  token.notifyEmail = user.notifyEmail ?? false
  token.notifyVk = user.notifyVk ?? false
  token.notifyTelegram = user.notifyTelegram ?? false
  token.notificationCategories = user.notificationCategories ?? []
  token.vkUserId = user.vkUserId ?? null
  token.telegramChatId = user.telegramChatId ?? null
  token.telegramUsername = user.telegramUsername ?? null
  token.yandexEmail = user.yandexEmail ?? null
  token.privacyConsentAt = user.privacyConsentAt ? user.privacyConsentAt.toISOString() : null
  token.privacyConsentVersion = user.privacyConsentVersion ?? null
  token.termsConsentAt = user.termsConsentAt ? user.termsConsentAt.toISOString() : null
  token.termsConsentVersion = user.termsConsentVersion ?? null
  token.profileCompletedAt = user.profileCompletedAt ? user.profileCompletedAt.toISOString() : null
}

const clearImpersonationTokenState = (token: Record<string, unknown>) => {
  token.impersonatorId = null
  token.impersonatorEmail = null
  token.impersonatorName = null
  token.impersonatorRole = null
}

const extractVkUserId = (profile: unknown, account?: OAuthAccountLike) => {
  const vkProfile = getVkProfileUser(profile)
  const resolvedValue =
    toNullableString(account?.providerAccountId) ??
    toNullableString(vkProfile?.id) ??
    toNullableString(vkProfile?.screen_name) ??
    toNullableString(vkProfile?.domain)

  return normalizeVkRecipient(resolvedValue).storageValue
}

const telegramAuthMaxAgeSeconds = 60 * 60 * 24

const readTelegramAuthValue = (value: unknown) => {
  if (typeof value === "string") return value.trim()
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return ""
}

const parseTelegramAuthPayload = (
  credentials: Record<string, unknown> | undefined
): TelegramAuthPayload | null => {
  if (!credentials) return null

  const id = readTelegramAuthValue(credentials.id)
  const firstName = readTelegramAuthValue(credentials.first_name)
  const authDateRaw = Number(readTelegramAuthValue(credentials.auth_date))
  const hash = readTelegramAuthValue(credentials.hash).toLowerCase()

  if (!id || !firstName || !Number.isInteger(authDateRaw) || !/^[a-f0-9]{64}$/i.test(hash)) {
    return null
  }

  return {
    id,
    first_name: firstName,
    last_name: readTelegramAuthValue(credentials.last_name) || null,
    username: readTelegramAuthValue(credentials.username) || null,
    photo_url: readTelegramAuthValue(credentials.photo_url) || null,
    auth_date: authDateRaw,
    hash,
  }
}

const buildTelegramDisplayName = (payload: TelegramAuthPayload) =>
  [payload.first_name, payload.last_name].filter(Boolean).join(" ").trim() || payload.username || null

const parseTelegramBotLoginPayload = (
  credentials: Record<string, unknown> | undefined
): TelegramBotLoginPayload | null => {
  if (!credentials) return null
  const loginToken = readTelegramAuthValue(credentials.loginToken)
  if (!loginToken || loginToken.length < 12) return null
  return { loginToken }
}

const verifyTelegramAuthPayload = (payload: TelegramAuthPayload) => {
  if (!telegramBotToken || !telegramBotUsername) return false

  const now = Math.floor(Date.now() / 1000)
  if (payload.auth_date < now - telegramAuthMaxAgeSeconds) {
    return false
  }

  const data = {
    auth_date: String(payload.auth_date),
    first_name: payload.first_name,
    id: payload.id,
    last_name: payload.last_name,
    photo_url: payload.photo_url,
    username: payload.username,
  }

  const dataCheckString = Object.entries(data)
    .filter(([, value]) => typeof value === "string" && value.length > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

  const secretKey = createHash("sha256").update(telegramBotToken).digest()
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  if (expectedHash.length !== payload.hash.length) return false

  return timingSafeEqual(Buffer.from(expectedHash, "hex"), Buffer.from(payload.hash, "hex"))
}

const resolveTelegramUser = async (payload: TelegramAuthPayload) => {
  const linkedAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "telegram",
        providerAccountId: payload.id,
      },
    },
    select: { userId: true },
  })

  let user = linkedAccount
    ? await prismaUser.findUnique<UserWithTelegram>({ where: { id: linkedAccount.userId } })
    : null

  const displayName = buildTelegramDisplayName(payload)
  const telegramUsername = payload.username || null

  if (!user) {
    const syntheticEmail = toSyntheticProviderEmail("telegram", payload.id)
    user = await prismaUser.findUnique<UserWithTelegram>({
      where: { email: syntheticEmail },
    })

    if (!user) {
      user = await prismaUser.create<UserWithTelegram>({
        data: {
          email: syntheticEmail,
          name: displayName,
          image: payload.photo_url,
          role: Role.STUDENT,
          telegramUsername,
        },
      })
    }
  }

  const userUpdates: Record<string, unknown> = {}
  if (!user.name && displayName) userUpdates.name = displayName
  if (!user.image && payload.photo_url) userUpdates.image = payload.photo_url
  if (telegramUsername) userUpdates.telegramUsername = telegramUsername

  if (Object.keys(userUpdates).length > 0) {
    user = await prismaUser.update<UserWithTelegram>({
      where: { id: user.id },
      data: userUpdates,
    })
  }

  if (!linkedAccount) {
    await prisma.account.create({
      data: {
        userId: user.id,
        type: "oauth",
        provider: "telegram",
        providerAccountId: payload.id,
      },
    })
  }

  return user
}

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

const vkProvider =
  vkClientId && vkClientSecret
    ? VKProvider({
        clientId: vkClientId,
        clientSecret: vkClientSecret,
        profile(profile: VkProfile, tokens) {
          const vkProfile = getVkProfileUser(profile)
          const enrichedTokens = tokens as typeof tokens & {
            email?: string | null
            user_id?: string | number | null
          }
          const resolvedVkId =
            toNullableString(vkProfile?.id) ??
            toNullableString(enrichedTokens.user_id)
          const providerId =
            resolvedVkId ||
            normalizeEmailAddress(enrichedTokens.email) ||
            "vk-unknown"
          const resolvedEmail =
            normalizeEmailAddress(enrichedTokens.email) ||
            toSyntheticProviderEmail("vk", providerId)

          return {
            id: providerId,
            name:
              [toNullableString(vkProfile?.first_name), toNullableString(vkProfile?.last_name)]
                .filter(Boolean)
                .join(" ") || null,
            email: resolvedEmail,
            image: toNullableString(vkProfile?.photo_100),
            role: Role.STUDENT,
            vkUserId: normalizeVkRecipient(resolvedVkId).storageValue,
          }
        },
      })
    : null

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: Role;
      image?: string | null;
      isScenarioPersona?: boolean;
      scenarioOwnerId?: string | null;
      impersonatorId?: string | null;
      impersonatorEmail?: string | null;
      impersonatorName?: string | null;
      impersonatorRole?: Role | null;
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
      notifyTelegram?: boolean;
      vkUserId?: string | null;
      telegramChatId?: string | null;
      telegramUsername?: string | null;
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
    isScenarioPersona?: boolean;
    scenarioOwnerId?: string | null;
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
    notifyTelegram?: boolean;
    vkUserId?: string | null;
    telegramChatId?: string | null;
    telegramUsername?: string | null;
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
    isScenarioPersona?: boolean;
    scenarioOwnerId?: string | null;
    impersonatorId?: string | null;
    impersonatorEmail?: string | null;
    impersonatorName?: string | null;
    impersonatorRole?: Role | null;
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
    notifyTelegram?: boolean;
    vkUserId?: string | null;
    telegramChatId?: string | null;
    telegramUsername?: string | null;
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
        const normalizedEmail = normalizeEmailAddress(credentials?.email)
        if (!normalizedEmail || !credentials?.password) {
          return null;
        }

        try {
          const user = await prismaUser.findFirst<UserWithTelegram>({
            where: buildEmailInsensitiveFilter(normalizedEmail),
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
            isScenarioPersona: user.isScenarioPersona ?? false,
            scenarioOwnerId: user.scenarioOwnerId ?? null,
            image: user.image,
            department: user.department,
            group: user.group,
            admissionYear: user.admissionYear,
            groupChangeCount: user.groupChangeCount ?? 0,
            bio: user.bio,
            notifyNewEvents: user.notifyNewEvents ?? true,
            notifyChanges: user.notifyChanges ?? true,
            notifyNews: user.notifyNews ?? false,
            notifyInApp: user.notifyInApp ?? true,
            notifyEmail: user.notifyEmail ?? false,
            notifyVk: user.notifyVk ?? false,
            notifyTelegram: user.notifyTelegram ?? false,
            vkUserId: user.vkUserId ?? null,
            telegramChatId: user.telegramChatId ?? null,
            telegramUsername: user.telegramUsername ?? null,
            yandexEmail: user.yandexEmail ?? null,
            privacyConsentAt: user.privacyConsentAt ?? null,
            privacyConsentVersion: user.privacyConsentVersion ?? null,
            termsConsentAt: user.termsConsentAt ?? null,
            termsConsentVersion: user.termsConsentVersion ?? null,
            profileCompletedAt: user.profileCompletedAt ?? null,
            notificationCategories: user.notificationCategories ?? [],
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
      },
    }),
    CredentialsProvider({
      id: "telegram",
      name: "telegram",
      credentials: {
        id: { label: "ID", type: "text" },
        first_name: { label: "First Name", type: "text" },
        last_name: { label: "Last Name", type: "text" },
        username: { label: "Username", type: "text" },
        photo_url: { label: "Photo URL", type: "text" },
        auth_date: { label: "Auth Date", type: "text" },
        hash: { label: "Hash", type: "text" },
      },
      async authorize(credentials): Promise<User | null> {
        const payload = parseTelegramAuthPayload(credentials)
        if (!payload || !verifyTelegramAuthPayload(payload)) {
          return null
        }

        try {
          const user = await resolveTelegramUser(payload)

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isScenarioPersona: user.isScenarioPersona ?? false,
            scenarioOwnerId: user.scenarioOwnerId ?? null,
            image: user.image,
            department: user.department,
            group: user.group,
            admissionYear: user.admissionYear,
            groupChangeCount: user.groupChangeCount ?? 0,
            bio: user.bio,
            notifyNewEvents: user.notifyNewEvents ?? true,
            notifyChanges: user.notifyChanges ?? true,
            notifyNews: user.notifyNews ?? false,
            notifyInApp: user.notifyInApp ?? true,
            notifyEmail: user.notifyEmail ?? false,
            notifyVk: user.notifyVk ?? false,
            notifyTelegram: user.notifyTelegram ?? false,
            vkUserId: user.vkUserId ?? null,
            telegramChatId: user.telegramChatId ?? null,
            telegramUsername: user.telegramUsername ?? payload.username ?? null,
            yandexEmail: user.yandexEmail ?? null,
            privacyConsentAt: user.privacyConsentAt ?? null,
            privacyConsentVersion: user.privacyConsentVersion ?? null,
            termsConsentAt: user.termsConsentAt ?? null,
            termsConsentVersion: user.termsConsentVersion ?? null,
            profileCompletedAt: user.profileCompletedAt ?? null,
            notificationCategories: user.notificationCategories ?? [],
          }
        } catch (error) {
          console.error("Telegram auth error:", error)
          return null
        }
      },
    }),
    CredentialsProvider({
      id: "telegram-bot",
      name: "telegram-bot",
      credentials: {
        loginToken: { label: "Login Token", type: "text" },
      },
      async authorize(credentials): Promise<User | null> {
        const payload = parseTelegramBotLoginPayload(credentials)
        if (!payload) return null

        try {
          const verificationToken = await prisma.verificationToken.findUnique({
            where: { token: payload.loginToken },
            select: {
              identifier: true,
              expires: true,
            },
          })

          if (
            !verificationToken ||
            verificationToken.expires <= new Date() ||
            !verificationToken.identifier.startsWith(TELEGRAM_LOGIN_COMPLETE_PREFIX)
          ) {
            return null
          }

          const userId = getTelegramUserIdFromLoginCompleteIdentifier(verificationToken.identifier)
          if (!userId) {
            await prisma.verificationToken.deleteMany({ where: { token: payload.loginToken } })
            return null
          }

          const user = await prismaUser.findUnique<UserWithTelegram>({
            where: { id: userId },
          })

          await prisma.verificationToken.deleteMany({ where: { token: payload.loginToken } })

          if (!user) {
            return null
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isScenarioPersona: user.isScenarioPersona ?? false,
            scenarioOwnerId: user.scenarioOwnerId ?? null,
            image: user.image,
            department: user.department,
            group: user.group,
            admissionYear: user.admissionYear,
            groupChangeCount: user.groupChangeCount ?? 0,
            bio: user.bio,
            notifyNewEvents: user.notifyNewEvents ?? true,
            notifyChanges: user.notifyChanges ?? true,
            notifyNews: user.notifyNews ?? false,
            notifyInApp: user.notifyInApp ?? true,
            notifyEmail: user.notifyEmail ?? false,
            notifyVk: user.notifyVk ?? false,
            notifyTelegram: user.notifyTelegram ?? false,
            vkUserId: user.vkUserId ?? null,
            telegramChatId: user.telegramChatId ?? null,
            telegramUsername: user.telegramUsername ?? null,
            yandexEmail: user.yandexEmail ?? null,
            privacyConsentAt: user.privacyConsentAt ?? null,
            privacyConsentVersion: user.privacyConsentVersion ?? null,
            termsConsentAt: user.termsConsentAt ?? null,
            termsConsentVersion: user.termsConsentVersion ?? null,
            profileCompletedAt: user.profileCompletedAt ?? null,
            notificationCategories: user.notificationCategories ?? [],
          }
        } catch (error) {
          console.error("Telegram bot login error:", error)
          return null
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
              const resolvedEmail =
                profile.default_email ||
                (Array.isArray(profile.emails) && profile.emails[0]) ||
                toSyntheticProviderEmail("yandex", profile.id)
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
                email: resolvedEmail,
                image: avatar,
                role: Role.STUDENT,
                yandexEmail: resolvedEmail.endsWith("@oauth.local") ? null : resolvedEmail,
              };
            },
          }),
        ]
      : []),
    ...(vkProvider ? [vkProvider] : []),
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

    async jwt({ token, user, account, profile, trigger, session }) {
      // При первом входе добавляем данные пользователя в токен.
      if (user) {
        applyUserRecordToToken(token, {
          id: user.id,
          email: user.email ?? "",
          name: user.name ?? null,
          image: user.image ?? null,
          role: user.role ?? Role.STUDENT,
          isScenarioPersona: user.isScenarioPersona ?? false,
          scenarioOwnerId: user.scenarioOwnerId ?? null,
          department: user.department ?? null,
          group: user.group ?? null,
          admissionYear: user.admissionYear ?? null,
          groupChangeCount: user.groupChangeCount ?? 0,
          bio: user.bio ?? null,
          notifyNewEvents: user.notifyNewEvents ?? true,
          notifyChanges: user.notifyChanges ?? true,
          notifyNews: user.notifyNews ?? false,
          notifyInApp: user.notifyInApp ?? true,
          notifyEmail: user.notifyEmail ?? false,
          notifyVk: user.notifyVk ?? false,
          notifyTelegram: user.notifyTelegram ?? false,
          notificationCategories: user.notificationCategories ?? [],
          vkUserId: user.vkUserId ?? null,
          telegramChatId: user.telegramChatId ?? null,
          telegramUsername: user.telegramUsername ?? null,
          yandexEmail: user.yandexEmail ?? null,
          privacyConsentAt: user.privacyConsentAt ?? null,
          privacyConsentVersion: user.privacyConsentVersion ?? null,
          termsConsentAt: user.termsConsentAt ?? null,
          termsConsentVersion: user.termsConsentVersion ?? null,
          profileCompletedAt: user.profileCompletedAt ?? null,
        })
        clearImpersonationTokenState(token)
      }

      if (account?.provider === "vk") {
        token.vkUserId =
          extractVkUserId(profile, account) ??
          user?.vkUserId ??
          token.vkUserId ??
          null
      }

      // При client-side update() синхронизируем измененные поля с токеном.
      if (trigger === "update") {
        const impersonation = readImpersonationUpdatePayload(
          (session as (typeof session & { impersonation?: unknown }) | undefined)?.impersonation
        )

        if (impersonation) {
          const actingAdminId =
            typeof token.impersonatorId === "string" && token.impersonatorId
              ? token.impersonatorId
              : token.role === Role.ADMIN && typeof token.id === "string"
                ? token.id
                : null

          if (actingAdminId) {
            const adminUser = await prismaUser.findUnique<SessionUserRecord>({
              where: { id: actingAdminId },
              select: selectSessionUserRecord,
            })

            if (adminUser?.role === Role.ADMIN) {
              if (impersonation.action === "start") {
                const targetUser = await prisma.user.findFirst({
                  where: {
                    id: impersonation.targetUserId,
                    isScenarioPersona: true,
                    scenarioOwnerId: actingAdminId,
                  },
                  select: selectSessionUserRecord,
                })

                if (targetUser) {
                  token.impersonatorId = adminUser.id
                  token.impersonatorEmail = adminUser.email
                  token.impersonatorName = adminUser.name
                  token.impersonatorRole = adminUser.role
                  applyUserRecordToToken(token, targetUser)

                  await logAuditEvent({
                    actorId: adminUser.id,
                    action: "ADMIN_SCENARIO_SWITCH_START",
                    entityType: "User",
                    entityId: targetUser.id,
                    metadata: {
                      targetRole: targetUser.role,
                      targetEmail: targetUser.email,
                    },
                  })
                }
              }

              if (impersonation.action === "stop" && typeof token.impersonatorId === "string") {
                applyUserRecordToToken(token, adminUser)
                clearImpersonationTokenState(token)

                await logAuditEvent({
                  actorId: adminUser.id,
                  action: "ADMIN_SCENARIO_SWITCH_STOP",
                  entityType: "User",
                  entityId: adminUser.id,
                  metadata: {
                    restoredRole: adminUser.role,
                  },
                })
              }
            }
          }

          return token
        }

        if (session?.user) {
          token.name = session.user.name;
          token.picture = session.user.image;
          token.isScenarioPersona = session.user.isScenarioPersona ?? token.isScenarioPersona ?? false;
          token.scenarioOwnerId = session.user.scenarioOwnerId ?? token.scenarioOwnerId ?? null;
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
          token.notifyTelegram = session.user.notifyTelegram ?? token.notifyTelegram ?? false;
          token.vkUserId = session.user.vkUserId ?? token.vkUserId ?? null;
          token.telegramChatId = session.user.telegramChatId ?? token.telegramChatId ?? null;
          token.telegramUsername = session.user.telegramUsername ?? token.telegramUsername ?? null;
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
      }

      return token;
    },

    async session({ session, token }) {
      const tokenId = typeof token.id === "string" ? token.id : null;
      const tokenEmail = typeof token.email === "string" ? token.email : null;

      if (tokenId || tokenEmail) {
        const existingUser = await prismaUser.findUnique<SessionUserRecord>({
          where: tokenId ? { id: tokenId } : { email: tokenEmail! },
          select: selectSessionUserRecord,
        });

        if (!existingUser) {
          return null as unknown as typeof session;
        }

        applyUserRecordToToken(token, existingUser)
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
        session.user.isScenarioPersona =
          typeof token.isScenarioPersona === "boolean" ? token.isScenarioPersona : false;
        session.user.scenarioOwnerId =
          typeof token.scenarioOwnerId === "string" ? token.scenarioOwnerId : null;
        session.user.impersonatorId =
          typeof token.impersonatorId === "string" ? token.impersonatorId : null;
        session.user.impersonatorEmail =
          typeof token.impersonatorEmail === "string" ? token.impersonatorEmail : null;
        session.user.impersonatorName =
          typeof token.impersonatorName === "string" ? token.impersonatorName : null;
        session.user.impersonatorRole =
          typeof token.impersonatorRole === "string" ? (token.impersonatorRole as Role) : null;
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
        session.user.notifyTelegram =
          typeof token.notifyTelegram === "boolean" ? token.notifyTelegram : false;
        session.user.vkUserId = typeof token.vkUserId === "string" ? token.vkUserId : null;
        session.user.telegramChatId =
          typeof token.telegramChatId === "string" ? token.telegramChatId : null;
        session.user.telegramUsername =
          typeof token.telegramUsername === "string" ? token.telegramUsername : null;
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
  secret: nextAuthSecret || undefined,
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      await logAuditEvent({
        actorId: user.id,
        action: "AUTH_SIGN_IN",
        entityType: "User",
        entityId: user.id,
        metadata: { provider: account?.provider, isNewUser: !!isNewUser },
      });

      const updates: Record<string, unknown> = {}
      if (account?.provider === "vk") {
        const vkUserId = extractVkUserId(profile, account)
        if (vkUserId) {
          updates.vkUserId = vkUserId
        }
      }
      if (account?.provider === "yandex" && user.email && !user.email.endsWith("@oauth.local")) {
        updates.yandexEmail = user.email
      }

      if (Object.keys(updates).length > 0) {
        await prisma.user.update({ where: { id: user.id }, data: updates }).catch(() => undefined)
      }
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
        useSecureAuthCookies
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureAuthCookies,
        // Domain задаем только в проде для реального домена.
        // domain: process.env.NODE_ENV === "production" ? ".your-domain.ru" : undefined,
      },
    },
  },
};
