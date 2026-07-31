import { config } from "@/lib/config"

export interface EmailContent {
  subject: string
  html: string
  text: string
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

const layout = (title: string, bodyHtml: string): string => `<!doctype html>
<html lang="cs">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:24px;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background-color:#ffffff;border-radius:16px;border:1px solid #e4e4e7;">
      <tr>
        <td style="padding:32px 32px 28px;">
          <p style="margin:0 0 24px;font-size:15px;font-weight:600;letter-spacing:-0.01em;color:#18181b;">${escapeHtml(config.appName)}</p>
          ${bodyHtml}
        </td>
      </tr>
    </table>
  </body>
</html>`

const button = (href: string, label: string): string =>
  `<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;border-radius:999px;background-color:#4f46e5;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>`

const fallbackLink = (href: string): string =>
  `<p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#71717a;">Pokud tlačítko nefunguje, otevři tento odkaz:<br /><a href="${escapeHtml(href)}" style="color:#4f46e5;word-break:break-all;">${escapeHtml(href)}</a></p>`

export function invitationEmailTemplate(params: {
  inviterName: string
  orgName: string
  inviteUrl: string
}): EmailContent {
  const subject = `Pozvánka do workspace ${params.orgName}`
  const heading = "Byl jsi pozván do workspace"
  const intro = `${params.inviterName} tě zve do workspace ${params.orgName} v aplikaci ${config.appName}. Klikni na odkaz níže, vytvoř si účet nebo se přihlas a připoj se.`
  const expiry = "Odkaz platí 48 hodin."

  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:-0.01em;color:#18181b;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">${escapeHtml(intro)}</p>
    ${button(params.inviteUrl, "Přijmout pozvánku")}
    <p style="margin:20px 0 0;font-size:12px;color:#71717a;">${escapeHtml(expiry)}</p>
    ${fallbackLink(params.inviteUrl)}`,
  )

  const text = `${heading}\n\n${intro}\n\nOdkaz: ${params.inviteUrl}\n\n${expiry}`

  return { subject, html, text }
}

export function passwordResetEmailTemplate(params: { resetUrl: string }): EmailContent {
  const subject = `Obnovení hesla do aplikace ${config.appName}`
  const heading = "Obnovení hesla"
  const intro = `Dostali jsme žádost o obnovení hesla k tvému účtu v aplikaci ${config.appName}. Klikni na odkaz níže a nastav si nové heslo.`
  const expiry = "Odkaz platí 1 hodinu. Pokud jsi o obnovení nežádal, tenhle e-mail ignoruj."

  const html = layout(
    subject,
    `<h1 style="margin:0 0 12px;font-size:20px;font-weight:600;letter-spacing:-0.01em;color:#18181b;">${escapeHtml(heading)}</h1>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#3f3f46;">${escapeHtml(intro)}</p>
    ${button(params.resetUrl, "Nastavit nové heslo")}
    <p style="margin:20px 0 0;font-size:12px;color:#71717a;">${escapeHtml(expiry)}</p>
    ${fallbackLink(params.resetUrl)}`,
  )

  const text = `${heading}\n\n${intro}\n\nOdkaz: ${params.resetUrl}\n\n${expiry}`

  return { subject, html, text }
}
