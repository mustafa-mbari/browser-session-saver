const LOGO_URL    = process.env.SMTP_LOGO_URL || ''
const WEBSITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://browserhub.app'
const SUPPORT_EMAIL = process.env.SMTP_SUPPORT_EMAIL || 'support@browserhub.app'

function logoOrText(): string {
  if (LOGO_URL) {
    return `<a href="${WEBSITE_URL}" style="text-decoration: none;">
              <img src="${LOGO_URL}" alt="Browser Hub" width="160" style="display: block; width: 160px; height: auto;">
            </a>`
  }
  return `<a href="${WEBSITE_URL}" style="text-decoration: none; font-size: 22px; font-weight: 700; color: #1c1917; letter-spacing: -0.5px;">
            Browser Hub
          </a>`
}

export function wrapInBaseLayout(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Browser Hub</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f4; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  ${preheader ? `<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f5f5f4;">${preheader}</div>` : ''}

  <!-- Wrapper -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f4;">
    <tr>
      <td align="center" style="padding: 40px 20px;">

        <!-- Container -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom: 32px;">
              ${logoOrText()}
            </td>
          </tr>

          <!-- Content Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; border: 1px solid #e7e5e4; overflow: hidden;">
              <!-- Accent bar -->
              <div style="height: 4px; background: linear-gradient(90deg, #6366f1, #818cf8);"></div>
              <!-- Body -->
              <div style="padding: 40px 36px;">
                ${content}
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 32px; text-align: center;">
              <p style="margin: 0 0 8px; font-size: 13px; color: #a8a29e;">
                <a href="${WEBSITE_URL}" style="color: #78716c; text-decoration: none;">${WEBSITE_URL.replace(/^https?:\/\//, '')}</a>
              </p>
              <p style="margin: 0 0 8px; font-size: 12px; color: #a8a29e;">
                Questions? Contact us at
                <a href="mailto:${SUPPORT_EMAIL}" style="color: #6366f1; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>
              <p style="margin: 0; font-size: 11px; color: #d6d3d1;">
                &copy; ${new Date().getFullYear()} Browser Hub. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function button(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
  <tr>
    <td align="center">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:44px;v-text-anchor:middle;width:220px;" arcsize="18%" fillcolor="#6366f1">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;">${text}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${href}" style="display: inline-block; background-color: #6366f1; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 8px; text-align: center; mso-hide: all;">
        ${text}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`
}

export function heading(text: string): string {
  return `<h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #1c1917; line-height: 1.3;">${text}</h1>`
}

export function paragraph(text: string): string {
  return `<p style="margin: 0 0 16px; font-size: 15px; color: #44403c; line-height: 1.6;">${text}</p>`
}

export function smallText(text: string): string {
  return `<p style="margin: 0 0 8px; font-size: 13px; color: #78716c; line-height: 1.5;">${text}</p>`
}

export function divider(): string {
  return `<hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">`
}
