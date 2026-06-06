/**
 * File responsibility:
 * Normalize VK recipient identifiers for profile storage and outbound delivery.
 *
 * Main logic:
 * - Accept numeric IDs, `id123`, `@username` and `vk.com/...` links
 * - Return a compact storage value plus delivery-ready user/domain fields
 *
 * Integrations:
 * - src/server/notifications/notification-service.ts
 * - src/server/auth/profile-service.ts
 * - src/app/api/auth/profile/complete/route.ts
 */

export type NormalizedVkRecipient = {
  storageValue: string | null
  userId: string | null
  domain: string | null
}

const VK_LINK_PREFIX_RE = /^(?:https?:\/\/)?(?:m\.)?vk\.com\//i
const VK_QUERY_FRAGMENT_RE = /[?#].*$/
const VK_DOMAIN_RE = /^[A-Za-z0-9_.]{3,100}$/

export const normalizeVkRecipient = (value: unknown): NormalizedVkRecipient => {
  const raw = String(value ?? "").trim()
  if (!raw) {
    return {
      storageValue: null,
      userId: null,
      domain: null,
    }
  }

  let normalized = raw
    .replace(VK_LINK_PREFIX_RE, "")
    .replace(/^@/, "")
    .replace(VK_QUERY_FRAGMENT_RE, "")
    .trim()

  if (!normalized) {
    return {
      storageValue: null,
      userId: null,
      domain: null,
    }
  }

  const prefixedNumericMatch = normalized.match(/^id(\d+)$/i)
  if (prefixedNumericMatch) {
    normalized = prefixedNumericMatch[1]
  }

  if (/^\d+$/.test(normalized)) {
    return {
      storageValue: normalized,
      userId: normalized,
      domain: null,
    }
  }

  if (VK_DOMAIN_RE.test(normalized)) {
    const domain = normalized.toLowerCase()
    return {
      storageValue: domain,
      userId: null,
      domain,
    }
  }

  return {
    storageValue: raw,
    userId: null,
    domain: null,
  }
}

export const isVkRecipientConfigured = (value: unknown) => {
  const recipient = normalizeVkRecipient(value)
  return Boolean(recipient.userId || recipient.domain)
}
