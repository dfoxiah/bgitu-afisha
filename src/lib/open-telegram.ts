type OpenTelegramOptions = {
  appUrl?: string | null
  webUrl: string
  targetWindow?: Window | null
}

export const openTelegram = ({ webUrl, targetWindow }: OpenTelegramOptions) => {
  if (typeof window === "undefined") return

  const popup = targetWindow ?? window.open(webUrl, "_blank", "noopener,noreferrer")

  if (popup) {
    try {
      popup.opener = null
      popup.location.replace(webUrl)
      popup.focus?.()
    } catch {
      window.location.assign(webUrl)
    }
    return
  }

  window.location.assign(webUrl)
}
