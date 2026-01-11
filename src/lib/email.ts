import nodemailer from 'nodemailer';
import { env } from './env';

// Log environment variables for debugging
console.log('Email Config:', {
  hasUser: !!env.GMAIL_USER,
  hasPass: !!env.GMAIL_APP_PASSWORD,
  smtpHost: env.SMTP_HOST,
  smtpPort: env.SMTP_PORT,
  smtpSecure: env.SMTP_SECURE
});

// Create a simple in-memory email store for development
const devEmailStore: Array<{to: string; subject: string; text: string}> = [];

// Only create transporter if we have the required config
const transporter = env.GMAIL_USER && env.GMAIL_APP_PASSWORD
  ? nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: env.SMTP_PORT ? parseInt(env.SMTP_PORT) : 587,
      secure: env.SMTP_SECURE === 'true',
      auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false
      }
    })
  : null;

// Only verify connection if we have a transporter
if (transporter) {
  transporter.verify(function(error) {
    if (error) {
      console.error('SMTP connection error:', error);
    } else {
      console.log('SMTP server is ready to take our messages');
    }
  });
} else {
  console.log('Running in development mode without email configuration');
  console.log('Emails will be logged to the console instead of being sent');
}

type SendMailOptions = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export const sendEmail = async ({ to, subject, text, html }: SendMailOptions) => {
  // In development without email config, store the email in memory
  if (!transporter) {
    console.warn('Email not sent - no email configuration. Storing in dev email store.');
    devEmailStore.push({ to, subject, text });
    console.log('Dev Email Store:', devEmailStore);
    return { success: true, devMode: true, stored: true };
  }

  const from = `"${env.GMAIL_FROM_NAME || 'Umuganda SDA'}" <${env.GMAIL_USER}>`;
  
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text,
    });
    
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    
    // In development, still store the email even if sending fails
    if (process.env.NODE_ENV !== 'production') {
      devEmailStore.push({ to, subject, text });
      console.log('Email stored in dev store due to error:', { to, subject });
      return { success: true, devMode: true, error: 'Email stored in dev mode', stored: true };
    }
    
    throw new Error('Failed to send email');
  }
};

// Helper to get stored emails in development
export const getStoredEmails = () => [...devEmailStore];

export const sendPasswordResetEmail = async (email: string, token: string, expiresInMinutes: number) => {
  const resetLink = `${env.PRIMARY_ORIGIN || 'http://localhost:3000'}/reset-password/confirm?token=${encodeURIComponent(token)}`;
  
  const subject = 'Password Reset Request';
  const text = `
    You have requested to reset your password for the Umuganda SDA platform.
    
    Please click the following link to reset your password (valid for ${expiresInMinutes} minutes):
    ${resetLink}
    
    If you did not request this, please ignore this email.
  `;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2>Password Reset Request</h2>
      <p>You have requested to reset your password for the Umuganda SDA platform.</p>
      <p>Please click the button below to reset your password (valid for ${expiresInMinutes} minutes):</p>
      <div style="margin: 25px 0;">
        <a href="${resetLink}" 
           style="display: inline-block; padding: 10px 20px; background-color: #2d3748; color: white; 
                  text-decoration: none; border-radius: 5px; font-weight: bold;">
          Reset Password
        </a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #3182ce;">${resetLink}</p>
      <p>If you did not request this, please ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
      <p style="font-size: 0.875rem; color: #718096;">
        This is an automated message, please do not reply directly to this email.
      </p>
    </div>
  `;
  
  return sendEmail({
    to: email,
    subject,
    text,
    html,
  });
};
