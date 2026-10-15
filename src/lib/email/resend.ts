import { Resend } from "resend"
import { config } from "@/lib/config"
import { createServerLogger } from "@/lib/logger"

const logger = createServerLogger({ layer: "email", module: "resend" })

export interface SendTransactionalEmailParams {
  to: string
  subject: string
  html: string
  text: string
}

export interface SendTransactionalEmailResult {
  sent: boolean
  id?: string
}

export async function sendTransactionalEmail(
  params: SendTransactionalEmailParams,
): Promise<SendTransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey === undefined || apiKey.length === 0) {
    logger.warn(
      { to: params.to, subject: params.subject },
      "RESEND_API_KEY not configured, skipping transactional email",
    )

    return { sent: false }
  }

  try {
    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: config.emailFrom,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
    if (result.error !== null) {
      logger.error(
        { to: params.to, subject: params.subject, error: result.error.message },
        "Resend rejected transactional email",
      )

      return { sent: false }
    }

    const id = result.data?.id
    logger.info({ to: params.to, subject: params.subject, id }, "transactional email sent")

    return { sent: true, id }
  } catch (error) {
    logger.error(
      {
        to: params.to,
        subject: params.subject,
        error: error instanceof Error ? error.message : "unknown",
      },
      "transactional email send threw",
    )

    return { sent: false }
  }
}
