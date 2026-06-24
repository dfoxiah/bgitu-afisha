type OpenTelegramOptions = {
  appUrl?: string | null
  webUrl: string
  targetWindow?: Window | null
}

const createLaunchHtml = (appUrl: string | null, webUrl: string) => `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Открываем Telegram</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, rgba(239,246,255,1), rgba(255,255,255,1), rgba(236,254,255,1));
        font-family: Inter, system-ui, sans-serif;
        color: #183b70;
      }
      .card {
        width: min(440px, calc(100vw - 32px));
        border-radius: 24px;
        border: 1px solid rgba(59, 130, 246, 0.12);
        background: rgba(255,255,255,0.92);
        box-shadow: 0 18px 36px rgba(18,39,76,0.12);
        padding: 24px;
      }
      h1 { margin: 0 0 12px; font-size: 20px; }
      p { margin: 0; line-height: 1.6; color: rgba(24,59,112,0.78); }
      a {
        margin-top: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 16px;
        color: white;
        text-decoration: none;
        font-weight: 700;
        background: linear-gradient(90deg, #2458c6, #13b8c9);
      }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Открываем Telegram</h1>
      <p>Если приложение не откроется автоматически, используйте резервную ссылку.</p>
      <a href="${webUrl}">Открыть в браузере</a>
    </div>
    <script>
      const appUrl = ${JSON.stringify(appUrl)};
      const webUrl = ${JSON.stringify(webUrl)};
      const fallback = () => {
        const hasFocus = typeof document.hasFocus === "function" ? document.hasFocus() : true;
        if (document.visibilityState === "visible" && hasFocus) {
          window.location.replace(webUrl);
        }
      };
      if (appUrl) {
        window.setTimeout(fallback, 1400);
        window.location.href = appUrl;
      } else {
        window.location.replace(webUrl);
      }
    </script>
  </body>
</html>`

export const openTelegram = ({ appUrl, webUrl, targetWindow }: OpenTelegramOptions) => {
  if (typeof window === "undefined") return

  const popup = targetWindow ?? window.open("", "_blank")

  if (popup) {
    popup.opener = null
    popup.document.open()
    popup.document.write(createLaunchHtml(appUrl ?? null, webUrl))
    popup.document.close()
    return
  }

  if (appUrl) {
    window.setTimeout(() => {
      const hasFocus = typeof document.hasFocus === "function" ? document.hasFocus() : true
      if (document.visibilityState === "visible" && hasFocus) {
        window.location.assign(webUrl)
      }
    }, 1400)
    window.location.assign(appUrl)
    return
  }

  window.location.assign(webUrl)
}
