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
