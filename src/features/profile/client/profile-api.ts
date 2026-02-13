/**
 * File responsibility:
 * Client-side profile API adapter.
 *
 * Main logic:
 * - Update current user profile with unified error handling
 *
 * Integrations:
 * - src/contexts/AppContext.tsx
 * - src/app/profile/page.tsx
 */

type UpdateProfilePayload = Record<string, unknown>

export type UpdateProfileResponse = {
  success?: boolean
  message?: string
  user?: {
    groupChangeCount?: number
    [key: string]: unknown
  }
  [key: string]: unknown
}

const toError = async (response: Response, fallback: string) => {
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) return new Error(fallback)

  const payload = await response.json()
  const message =
    typeof payload?.error === "string"
      ? payload.error
      : typeof payload?.errorPayload?.message === "string"
        ? payload.errorPayload.message
        : fallback

  return new Error(message)
}

export const updateProfileApi = async (payload: UpdateProfilePayload) => {
  const response = await fetch("/api/auth/profile", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw await toError(response, "Ошибка обновления профиля")
  }

  return response.json() as Promise<UpdateProfileResponse>
}
