import { wrapInBaseLayout, heading, paragraph, divider, smallText, button } from './base'

const WEBSITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://browserhub.app'

export function buildSuggestionReplyEmail(params: {
  userName: string | null
  suggestionTitle: string
  message: string
  status: string
}): { subject: string; html: string } {
  const greeting    = params.userName ? `Hi ${params.userName},` : 'Hi,'
  const statusLabel = params.status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

  const content = [
    heading('Update on Your Suggestion'),
    paragraph(greeting),
    paragraph(`We have an update regarding your suggestion: <strong>"${params.suggestionTitle}"</strong>`),

    `<div style="margin: 0 0 16px;">
      <span style="display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; background-color: #e0e7ff; color: #4338ca;">
        Status: ${statusLabel}
      </span>
    </div>`,

    divider(),

    `<div style="background-color: #f5f5f4; border-radius: 8px; border: 1px solid #e7e5e4; padding: 20px; margin: 0 0 16px;">
      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #78716c; text-transform: uppercase; letter-spacing: 0.05em;">Message from our team</p>
      <p style="margin: 0; font-size: 15px; color: #1c1917; line-height: 1.6; white-space: pre-wrap;">${params.message}</p>
    </div>`,

    paragraph('Thank you for helping us improve Browser Hub. Your feedback is valuable to us!'),

    button('View Suggestions', `${WEBSITE_URL}/suggestions`),

    divider(),
    smallText('This email was sent in response to your feature suggestion on Browser Hub.'),
  ].join('\n')

  return {
    subject: `Re: [Suggestion] ${params.suggestionTitle}`,
    html: wrapInBaseLayout(content, `Update on your suggestion: "${params.suggestionTitle}"`),
  }
}
