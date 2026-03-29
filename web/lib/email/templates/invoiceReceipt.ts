import { wrapInBaseLayout, heading, paragraph, divider, smallText } from './base'

const SUPPORT_EMAIL = process.env.SMTP_SUPPORT_EMAIL || 'support@browserhub.app'

export function buildInvoiceReceiptEmail(params: {
  displayName: string | null
  amount: string
  currency: string
  planName: string
  invoiceDate: string
  invoiceNumber: string | null
  invoiceUrl: string | null
}): { subject: string; html: string } {
  const greeting = params.displayName ? `Hi ${params.displayName},` : 'Hi,'

  const content = `
    ${heading('Payment Receipt')}
    ${paragraph(greeting)}
    ${paragraph('Thank you for your payment. Here\'s your receipt:')}

    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 24px 0; border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden;">
      <tr>
        <td style="padding: 20px; background-color: #fafaf9;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            ${params.invoiceNumber ? `<tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">
                <span style="font-size: 13px; color: #78716c;">Invoice</span>
                <span style="float: right; font-size: 14px; color: #1c1917;">${params.invoiceNumber}</span>
              </td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">
                <span style="font-size: 13px; color: #78716c;">Date</span>
                <span style="float: right; font-size: 14px; color: #1c1917;">${params.invoiceDate}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e7e5e4;">
                <span style="font-size: 13px; color: #78716c;">Plan</span>
                <span style="float: right; font-size: 14px; color: #1c1917;">${params.planName}</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 12px 0 0;">
                <span style="font-size: 14px; color: #78716c; font-weight: 600;">Total</span>
                <span style="float: right; font-size: 18px; color: #1c1917; font-weight: 700;">${params.amount} ${params.currency.toUpperCase()}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    ${params.invoiceUrl ? `<p style="margin: 0 0 16px; text-align: center;">
      <a href="${params.invoiceUrl}" style="color: #6366f1; font-size: 14px; text-decoration: none; font-weight: 500;">View full invoice &rarr;</a>
    </p>` : ''}

    ${divider()}
    ${smallText(`This receipt was generated automatically. If you have questions about this charge, contact us at ${SUPPORT_EMAIL}.`)}
  `

  return {
    subject: `Browser Hub payment receipt - ${params.amount} ${params.currency.toUpperCase()}`,
    html: wrapInBaseLayout(content, `Payment receipt for ${params.planName} - ${params.amount} ${params.currency.toUpperCase()}`),
  }
}
