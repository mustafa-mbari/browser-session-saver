import { wrapInBaseLayout, button, heading, paragraph, divider, smallText } from './base'

export function buildPasswordResetEmail(params: {
  resetUrl: string
  displayName: string | null
}): { subject: string; html: string } {
  const greeting = params.displayName ? `Hi ${params.displayName},` : 'Hi there,'

  const content = `
    ${heading('Reset Your Password')}
    ${paragraph(greeting)}
    ${paragraph('We received a request to reset your Browser Hub password. Click the button below to choose a new password.')}

    ${button('Reset Password', params.resetUrl)}

    ${paragraph('This link will expire in 1 hour. If you didn\'t request a password reset, you can safely ignore this email — your password will remain unchanged.')}
    ${divider()}
    ${smallText('If the button doesn\'t work, copy and paste this link into your browser:')}
    <p style="margin: 0; font-size: 12px; color: #6366f1; word-break: break-all;">
      <a href="${params.resetUrl}" style="color: #6366f1; text-decoration: none;">${params.resetUrl}</a>
    </p>
  `

  return {
    subject: 'Reset your Browser Hub password',
    html: wrapInBaseLayout(content, 'Reset your Browser Hub password.'),
  }
}
