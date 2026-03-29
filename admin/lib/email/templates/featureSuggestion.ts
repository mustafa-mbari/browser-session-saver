import { wrapInBaseLayout, heading, paragraph, divider, smallText } from './base'

export function buildFeatureSuggestionEmail(params: {
  userName: string | null
  userEmail: string
  suggestionType: string
  title: string
  description: string
  importance: string
}): { subject: string; html: string } {
  const content = `
    ${heading('New Feature Suggestion')}
    ${paragraph(`<strong>From:</strong> ${params.userName || 'Unknown'} (${params.userEmail})`)}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0;">
      <tr>
        <td style="padding: 16px; background-color: #eef2ff; border-radius: 8px; border: 1px solid #c7d2fe;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="padding: 4px 0;"><strong style="color: #1c1917; font-size: 13px;">Type:</strong> <span style="color: #44403c; font-size: 13px;">${params.suggestionType}</span></td></tr>
            <tr><td style="padding: 4px 0;"><strong style="color: #1c1917; font-size: 13px;">Importance:</strong> <span style="color: #44403c; font-size: 13px;">${params.importance}</span></td></tr>
          </table>
        </td>
      </tr>
    </table>

    ${paragraph(`<strong>Title:</strong> ${params.title}`)}
    ${paragraph(params.description || '<em>No description provided.</em>')}
    ${divider()}
    ${smallText('This suggestion was submitted via the Browser Hub website.')}
  `

  return {
    subject: `[Suggestion] ${params.title}`,
    html: wrapInBaseLayout(content, `New feature suggestion from ${params.userEmail}`),
  }
}
