import type { Role } from "@prisma/client"

export const PRIVACY_POLICY_VERSION = "2026-05-13"
export const TERMS_VERSION = "2026-05-13"

export type ProfileCompletionUser = {
  name?: string | null
  email?: string | null
  department?: string | null
  group?: string | null
  admissionYear?: number | null
  role?: Role | string | null
  privacyConsentAt?: Date | string | null
  termsConsentAt?: Date | string | null
  privacyConsentVersion?: string | null
  termsConsentVersion?: string | null
  profileCompletedAt?: Date | string | null
}

type ProfileCompletionWriteUser = ProfileCompletionUser & {
  consentSource?: string | null
}

const isFilled = (value?: string | null) => Boolean(value && value.trim().length > 0)

const isSyntheticOAuthEmail = (email?: string | null) =>
  Boolean(email && /@oauth\.local$/i.test(email))

export const getProfileCompletionIssues = (user: ProfileCompletionUser) => {
  const issues: string[] = []
  const isStudent = !user.role || user.role === "STUDENT"

  if (!isFilled(user.name)) issues.push("Укажите ФИО")
  if (!isFilled(user.email) || isSyntheticOAuthEmail(user.email)) issues.push("Укажите рабочий email")
  if (!isFilled(user.department)) issues.push("Укажите факультет или кафедру")

  if (isStudent) {
    if (!isFilled(user.group)) issues.push("Укажите учебную группу")
    if (!user.admissionYear) issues.push("Укажите год поступления")
  }

  if (!user.privacyConsentAt || user.privacyConsentVersion !== PRIVACY_POLICY_VERSION) {
    issues.push("Примите актуальную политику конфиденциальности")
  }

  if (!user.termsConsentAt || user.termsConsentVersion !== TERMS_VERSION) {
    issues.push("Примите актуальное пользовательское соглашение")
  }

  return issues
}

export const isProfileComplete = (user: ProfileCompletionUser) =>
  Boolean(user.profileCompletedAt) && getProfileCompletionIssues(user).length === 0

const toValidDate = (value?: Date | string | null) => {
  if (!value) return null

  const parsed = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const deriveProfileCompletionState = (
  user: ProfileCompletionWriteUser,
  fallbackConsentSource = "profile",
  now = new Date()
) => {
  const hasPrivacyConsent = Boolean(user.privacyConsentAt)
  const hasTermsConsent = Boolean(user.termsConsentAt)
  const privacyConsentVersion = hasPrivacyConsent ? PRIVACY_POLICY_VERSION : null
  const termsConsentVersion = hasTermsConsent ? TERMS_VERSION : null
  const consentSource =
    hasPrivacyConsent || hasTermsConsent
      ? user.consentSource?.trim() || fallbackConsentSource
      : null
  const completedAtCandidate = toValidDate(user.profileCompletedAt) || now
  const profileCompletedAt =
    getProfileCompletionIssues({
      ...user,
      privacyConsentVersion,
      termsConsentVersion,
      profileCompletedAt: completedAtCandidate,
    }).length === 0
      ? completedAtCandidate
      : null

  return {
    privacyConsentVersion,
    termsConsentVersion,
    consentSource,
    profileCompletedAt,
  }
}
