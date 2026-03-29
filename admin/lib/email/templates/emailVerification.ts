import { wrapInBaseLayout, button, heading, paragraph, divider, smallText } from './base'

export function buildEmailVerificationEmail(params: {
  verificationUrl: string
  displayName: string | null
}): { subject: string; html: string } {
  const greeting = params.displayName ? `Hi ${params.displayName},` : 'Hi there,'

  const content = `
    ${heading('Verify Your Email')}
    ${paragraph(greeting)}
    ${paragraph('Thanks for creating a Browser Hub account. Please verify your email address by clicking the button below.')}

    ${button('Verify Email', params.verificationUrl)}

    ${paragraph('This link will expire in 24 hours. If you didn\'t create a Browser Hub account, you can safely ignore this email.')}
    ${divider()}
    ${smallText('If the button doesn\'t work, copy and paste this link into your browser:')}
    <p style="margin: 0; font-size: 12px; color: #6366f1; word-break: break-all;">
      <a href="${params.verificationUrl}" style="color: #6366f1; text-decoration: none;">${params.verificationUrl}</a>
    </p>
  `

  return {
    subject: 'Verify your Browser Hub email',
    html: wrapInBaseLayout(content, 'Please verify your email to get started with Browser Hub.'),
  }
}
