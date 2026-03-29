import { wrapInBaseLayout, button, heading, paragraph, divider, smallText } from './base'

const WEBSITE_URL   = process.env.NEXT_PUBLIC_SITE_URL || 'https://browserhub.app'
const SUPPORT_EMAIL = process.env.SMTP_SUPPORT_EMAIL   || 'support@browserhub.app'

export function buildPasswordResetConfirmationEmail(params: {
  displayName: string | null
}): { subject: string; html: string } {
  const greeting = params.displayName ? `Hi ${params.displayName},` : 'Hi,'

  const content = `
    ${heading('Password Updated')}
    ${paragraph(greeting)}
    ${paragraph('Your password has been successfully changed. You can now sign in with your new password.')}

    ${button('Sign In', `${WEBSITE_URL}/login`)}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="padding: 16px; background-color: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
          <p style="margin: 0; font-size: 13px; color: #991b1b;">
            <strong>Didn't make this change?</strong> If you didn't reset your password, please contact us immediately at
            <a href="mailto:${SUPPORT_EMAIL}" style="color: #6366f1; text-decoration: none;">${SUPPORT_EMAIL}</a>.
          </p>
        </td>
      </tr>
    </table>

    ${divider()}
    ${smallText('This is an automated security notification from Browser Hub.')}
  `

  return {
    subject: 'Your password has been updated',
    html: wrapInBaseLayout(content, 'Your Browser Hub password has been successfully changed.'),
  }
}
