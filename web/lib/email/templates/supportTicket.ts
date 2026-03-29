import { wrapInBaseLayout, heading, paragraph, divider, smallText } from './base'

export function buildSupportTicketEmail(params: {
  userName: string | null
  userEmail: string
  issueType: string
  subject: string
  description: string
  priority: string
}): { subject: string; html: string } {
  const content = `
    ${heading('New Support Ticket')}
    ${paragraph(`<strong>From:</strong> ${params.userName || 'Unknown'} (${params.userEmail})`)}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0;">
      <tr>
        <td style="padding: 16px; background-color: #fef2f2; border-radius: 8px; border: 1px solid #fecaca;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="padding: 4px 0;"><strong style="color: #1c1917; font-size: 13px;">Type:</strong> <span style="color: #44403c; font-size: 13px;">${params.issueType}</span></td></tr>
            <tr><td style="padding: 4px 0;"><strong style="color: #1c1917; font-size: 13px;">Priority:</strong> <span style="color: #44403c; font-size: 13px;">${params.priority}</span></td></tr>
          </table>
        </td>
      </tr>
    </table>

    ${paragraph(`<strong>Subject:</strong> ${params.subject}`)}
    ${paragraph(params.description)}
    ${divider()}
    ${smallText('This ticket was submitted via the Browser Hub website.')}
  `

  return {
    subject: `[Support] ${params.subject}`,
    html: wrapInBaseLayout(content, `New support ticket from ${params.userEmail}`),
  }
}
