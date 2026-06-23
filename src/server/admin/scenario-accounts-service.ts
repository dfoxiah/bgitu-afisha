/**
 * File responsibility:
 * Scenario accounts bootstrap/list helpers for admin role testing flows.
 *
 * Main logic:
 * - Create one admin-owned persona for each role
 * - Keep persona profile data deterministic and easy to recognize
 *
 * Integrations:
 * - src/app/api/admin/scenario-accounts/route.ts
 * - src/lib/auth.ts impersonation callback
 */

import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { Role, type Prisma } from "@prisma/client"
import { deriveProfileCompletionState } from "@/lib/profile-completion"
import { prisma } from "@/lib/prisma"

const SCENARIO_ROLES: Role[] = ["STUDENT", "TEACHER", "MODERATOR", "EDITOR", "ADMIN"]

const scenarioAccountSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isScenarioPersona: true,
  scenarioOwnerId: true,
  department: true,
  group: true,
  admissionYear: true,
  groupChangeCount: true,
  bio: true,
  privacyConsentAt: true,
  termsConsentAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect

type ScenarioOwner = {
  id: string
  name: string | null
  email: string
  department: string | null
}

const normalizeEmailLocal = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")

  return normalized || "admin"
}

const buildScenarioEmail = (owner: ScenarioOwner, role: Role) => {
  const [localPart, domainPartRaw] = owner.email.split("@")
  const domainPart = (domainPartRaw || "bgitu.ru").toLowerCase()
  const ownerSuffix = owner.id.slice(-6).toLowerCase()
  return `${normalizeEmailLocal(localPart)}+scenario-${role.toLowerCase()}-${ownerSuffix}@${domainPart}`
}

const buildScenarioName = (owner: ScenarioOwner, role: Role) => {
  const baseName = owner.name?.trim() || owner.email
  const roleTitle =
    role === "STUDENT"
      ? "Студент"
      : role === "TEACHER"
        ? "Преподаватель"
        : role === "MODERATOR"
          ? "Модератор"
          : role === "EDITOR"
            ? "Редактор"
            : "Администратор"

  return `${baseName} · сценарий ${roleTitle}`
}

const getScenarioDefaults = (owner: ScenarioOwner, role: Role) => {
  const ownerSuffix = owner.id.slice(-4).toUpperCase()
  const sharedDepartment = owner.department?.trim() || "Тестовый контур БГИТУ"

  if (role === "STUDENT") {
    return {
      department: sharedDepartment,
      group: `SCN-${ownerSuffix}`,
      admissionYear: new Date().getFullYear(),
      bio: "Сценарный аккаунт студента для проверки пользовательских потоков.",
    }
  }

  if (role === "EDITOR") {
    return {
      department: "Редакция БГИТУ",
      group: null,
      admissionYear: null,
      bio: "Сценарный аккаунт редактора для проверки пользовательских потоков.",
    }
  }

  if (role === "ADMIN") {
    return {
      department: "Администрация БГИТУ",
      group: null,
      admissionYear: null,
      bio: "Сценарный аккаунт администратора для проверки пользовательских потоков.",
    }
  }

  return {
    department: sharedDepartment,
    group: null,
    admissionYear: null,
    bio:
      role === "MODERATOR"
        ? "Сценарный аккаунт модератора для проверки пользовательских потоков."
        : "Сценарный аккаунт преподавателя для проверки пользовательских потоков.",
  }
}

export const getScenarioAccountsForOwner = async (ownerId: string) =>
  prisma.user.findMany({
    where: {
      scenarioOwnerId: ownerId,
      isScenarioPersona: true,
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: scenarioAccountSelect,
  })

export const getScenarioAccountForOwner = async (ownerId: string, targetUserId: string) =>
  prisma.user.findFirst({
    where: {
      id: targetUserId,
      scenarioOwnerId: ownerId,
      isScenarioPersona: true,
    },
    select: scenarioAccountSelect,
  })

export const ensureScenarioAccountsForOwner = async (ownerId: string) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
    },
  })

  if (!owner) {
    throw new Error("Администратор-владелец сценарных аккаунтов не найден")
  }

  const currentAccounts = await prisma.user.findMany({
    where: {
      scenarioOwnerId: owner.id,
      isScenarioPersona: true,
    },
    select: {
      id: true,
      role: true,
      privacyConsentAt: true,
      termsConsentAt: true,
      profileCompletedAt: true,
      consentSource: true,
      password: true,
    },
  })

  const byRole = new Map(currentAccounts.map((account) => [account.role, account]))
  const consentAt = new Date()

  for (const role of SCENARIO_ROLES) {
    const defaults = getScenarioDefaults(owner, role)
    const email = buildScenarioEmail(owner, role)
    const name = buildScenarioName(owner, role)
    const existing = byRole.get(role)

    const completionState = deriveProfileCompletionState(
      {
        name,
        email,
        role,
        department: defaults.department,
        group: defaults.group,
        admissionYear: defaults.admissionYear,
        privacyConsentAt: existing?.privacyConsentAt ?? consentAt,
        termsConsentAt: existing?.termsConsentAt ?? consentAt,
        consentSource: existing?.consentSource ?? "admin-scenario",
        profileCompletedAt: existing?.profileCompletedAt ?? consentAt,
      },
      "admin-scenario",
      consentAt
    )

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name,
          email,
          role,
          isScenarioPersona: true,
          scenarioOwnerId: owner.id,
          department: defaults.department,
          group: defaults.group,
          admissionYear: defaults.admissionYear,
          bio: defaults.bio,
          privacyConsentAt: existing.privacyConsentAt ?? consentAt,
          termsConsentAt: existing.termsConsentAt ?? consentAt,
          ...completionState,
        },
      })
      continue
    }

    const generatedPassword = randomBytes(24).toString("base64url")
    const hashedPassword = await bcrypt.hash(generatedPassword, 10)

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        isScenarioPersona: true,
        scenarioOwnerId: owner.id,
        department: defaults.department,
        group: defaults.group,
        admissionYear: defaults.admissionYear,
        bio: defaults.bio,
        notifyNewEvents: true,
        notifyChanges: true,
        notifyNews: true,
        notifyInApp: true,
        notifyEmail: false,
        notifyVk: false,
        notifyTelegram: false,
        privacyConsentAt: consentAt,
        termsConsentAt: consentAt,
        ...completionState,
      },
    })
  }

  return getScenarioAccountsForOwner(owner.id)
}
