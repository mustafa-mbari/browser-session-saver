import nodemailer from 'nodemailer'

export function getTransporter(): nodemailer.Transporter {
  const port = Number(process.env.SMTP_PORT) || 465

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.resend.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER || 'resend',
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
}

export function getFromAddress() {
  const name = process.env.SMTP_FROM_NAME || 'Browser Hub'
  const email = process.env.SMTP_FROM_EMAIL || 'info@browserhub.app'
  return `"${name}" <${email}>`
}

export function getSmtpConfig() {
  const host = process.env.SMTP_HOST || 'smtp.resend.com'
  const port = Number(process.env.SMTP_PORT) || 465
  const from = process.env.SMTP_FROM_EMAIL || 'info@browserhub.app'
  const secure = port === 465
  const configured = !!process.env.SMTP_PASS
  return { host, port, from, secure: secure ? 'SSL/TLS' : 'STARTTLS', configured }
}

export async function verifyConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const transporter = getTransporter()
    await transporter.verify()
    return { ok: true }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'SMTP connection failed',
    }
  }
}
