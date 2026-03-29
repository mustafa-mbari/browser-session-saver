import { wrapInBaseLayout, button, heading, paragraph, divider, smallText } from './base'

const WEBSITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://browserhub.app'

export function buildWelcomeEmail(params: { displayName: string | null }): { subject: string; html: string } {
  const greeting = params.displayName ? `Hi ${params.displayName},` : 'Hi there,'

  const content = `
    ${heading('Welcome to Browser Hub!')}
    ${paragraph(greeting)}
    ${paragraph('Your account is verified and ready to go. Start saving and managing your browser sessions with ease.')}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0;">
      <tr>
        <td style="padding: 12px 16px; background-color: #f5f5f4; border-radius: 8px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #1c1917; font-size: 14px;">&#128190; Save &amp; restore sessions</strong>
                <br><span style="color: #78716c; font-size: 13px;">Capture all your open tabs and restore them in one click</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #1c1917; font-size: 14px;">&#9729;&#65039; Cloud sync</strong>
                <br><span style="color: #78716c; font-size: 13px;">Sync sessions and prompts seamlessly across devices</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #1c1917; font-size: 14px;">&#128218; Tab groups &amp; templates</strong>
                <br><span style="color: #78716c; font-size: 13px;">Organise and reuse your favourite tab group setups</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #1c1917; font-size: 14px;">&#10024; Prompt manager</strong>
                <br><span style="color: #78716c; font-size: 13px;">Store and reuse AI prompts instantly from any tab</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0;">
                <strong style="color: #1c1917; font-size: 14px;">&#128179; Subscription tracker</strong>
                <br><span style="color: #78716c; font-size: 13px;">Never miss a renewal — track all your subscriptions in one place</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${button('Go to Dashboard', `${WEBSITE_URL}/dashboard`)}
    ${divider()}
    ${smallText('If you have any questions, reply to this email or contact us at support@browserhub.app.')}
  `

  return {
    subject: 'Welcome to Browser Hub!',
    html: wrapInBaseLayout(content, 'Your account is ready. Start managing your browser sessions today.'),
  }
}
