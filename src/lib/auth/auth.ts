import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { organization } from "better-auth/plugins"
import { config } from "@/lib/config"
import { seedOrganizationDefaults } from "@/lib/crm/store/orgDefaults"
import { sendTransactionalEmail } from "@/lib/email/resend"
import { invitationEmailTemplate, passwordResetEmailTemplate } from "@/lib/email/templates"
import { createServerLogger } from "@/lib/logger"
import { db } from "@/lib/db/client"
import { accounts, sessions, users, verifications } from "@/lib/db/schema/auth"
import { organizationInvitations, organizationMembers, organizations } from "@/lib/db/schema/org"

const authLogger = createServerLogger({ layer: "auth", module: "email" })

// Records whether the last invitation email for an address was actually delivered,
// keyed by lowercased email. The better-auth createInvitation call runs the send hook
// synchronously, so the invite server action reads the outcome right after and tells
// the user the truth instead of assuming success. Single-process app, so one instance
// in module scope is enough.
class InvitationEmailOutcomes {
  private readonly outcomes = new Map<string, boolean>()

  public record(email: string, sent: boolean): void {
    this.outcomes.set(InvitationEmailOutcomes.keyOf(email), sent)
  }

  // Reads and clears the recorded outcome. `undefined` when none was recorded (the hook
  // never ran), which callers treat as "assume sent".
  public take(email: string): boolean | undefined {
    const key = InvitationEmailOutcomes.keyOf(email)
    const outcome = this.outcomes.get(key)
    this.outcomes.delete(key)

    return outcome
  }

  private static keyOf(email: string): string {
    return email.trim().toLowerCase()
  }
}

const invitationEmailOutcomes = new InvitationEmailOutcomes()

export function takeInvitationEmailOutcome(email: string): boolean | undefined {
  return invitationEmailOutcomes.take(email)
}

export const auth = betterAuth({
  baseURL: config.authBaseUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
      organization: organizations,
      member: organizationMembers,
      invitation: organizationInvitations,
    },
  }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, token }) => {
      const resetUrl = `${config.authBaseUrl}/reset-hesla?token=${token}`
      const email = passwordResetEmailTemplate({ resetUrl })
      const result = await sendTransactionalEmail({
        to: user.email,
        subject: email.subject,
        html: email.html,
        text: email.text,
      })
      if (!result.sent) {
        authLogger.warn({ to: user.email }, "password reset email not delivered")
      }
    },
  },
  plugins: [
    organization({
      creatorRole: "owner",
      sendInvitationEmail: async (data) => {
        const inviteUrl = `${config.authBaseUrl}/invite/${data.id}`
        const email = invitationEmailTemplate({
          inviterName: data.inviter.user.name,
          orgName: data.organization.name,
          inviteUrl,
        })
        // Selhání odeslání nesmí zablokovat vytvoření pozvánky; kopírovatelný
        // odkaz v UI zůstává jako fallback.
        const result = await sendTransactionalEmail({
          to: data.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        })
        invitationEmailOutcomes.record(data.email, result.sent)
        if (!result.sent) {
          authLogger.warn({ to: data.email }, "invitation email not delivered")
        }
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization }) => {
          await seedOrganizationDefaults(organization.id)
        },
      },
    }),
    nextCookies(),
  ],
})
