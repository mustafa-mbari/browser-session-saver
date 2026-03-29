import { buildWelcomeEmail } from './templates/welcome'
import { buildEmailVerificationEmail } from './templates/emailVerification'
import { buildPasswordResetEmail } from './templates/passwordReset'
import { buildPasswordResetConfirmationEmail } from './templates/passwordResetConfirmation'
import { buildBillingNotificationEmail } from './templates/billingNotification'
import { buildInvoiceReceiptEmail } from './templates/invoiceReceipt'
import { buildTrialEndingEmail } from './templates/trialEnding'
import { buildTicketReplyEmail } from './templates/ticketReply'
import { buildSuggestionReplyEmail } from './templates/suggestionReply'

export function renderTestTemplate(template: string): { subject: string; html: string } {
  switch (template) {
    case 'welcome':
      return buildWelcomeEmail({ displayName: 'Jane Doe' })
    case 'email_verification':
      return buildEmailVerificationEmail({
        verificationUrl: 'https://browserhub.app/auth/confirm?token_hash=example&type=magiclink',
        displayName: 'Jane Doe',
      })
    case 'password_reset':
      return buildPasswordResetEmail({
        resetUrl: 'https://browserhub.app/auth/confirm?token_hash=example&type=recovery',
        displayName: 'Jane Doe',
      })
    case 'password_reset_confirmation':
      return buildPasswordResetConfirmationEmail({ displayName: 'Jane Doe' })
    case 'billing_notification':
      return buildBillingNotificationEmail({
        event: 'subscription_created',
        planName: 'Premium Monthly',
        displayName: 'Jane Doe',
        periodEnd: 'April 1, 2026',
      })
    case 'invoice_receipt':
      return buildInvoiceReceiptEmail({
        displayName: 'Jane Doe',
        amount: '9.99',
        currency: 'usd',
        planName: 'Premium Monthly',
        invoiceDate: 'March 1, 2026',
        invoiceNumber: 'INV-2026-001',
        invoiceUrl: '#',
      })
    case 'trial_ending':
      return buildTrialEndingEmail({
        displayName: 'Jane Doe',
        daysRemaining: 3,
        trialEndDate: 'April 4, 2026',
      })
    case 'ticket_reply':
      return buildTicketReplyEmail({
        userName:      'Jane Doe',
        ticketSubject: 'Extension not saving sessions',
        message:       'Thanks for reaching out! We have identified the issue and it will be fixed in the next update.',
        status:        'resolved',
      })
    case 'suggestion_reply':
      return buildSuggestionReplyEmail({
        userName:        'Jane Doe',
        suggestionTitle: 'Add keyboard shortcut for quick save',
        message:         "Great suggestion! We've added this to our roadmap for an upcoming release.",
        status:          'under_review',
      })
    default:
      return { subject: 'Test Email', html: '<p>This is a test email from Browser Hub.</p>' }
  }
}
