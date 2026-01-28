import { Role } from '@prisma/client';
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

const resolveRoleLabel = (role: Role) => {
  switch (role) {
    case Role.UNION_ADMIN:
      return 'Union Administrator';
    case Role.DISTRICT_ADMIN:
      return 'District Pastor';
    case Role.CHURCH_ADMIN:
      return 'Church Administrator';
    default:
      return 'Umuganda SDA account';
  }
};

type SendAccountCredentialsEmailOptions = {
  to: string;
  role: Role;
  firstName?: string | null;
  username: string;
  password: string;
};

export const sendAccountCredentialsEmail = async ({
  to,
  role,
  firstName,
  username,
  password,
}: SendAccountCredentialsEmailOptions) => {
  const loginUrl = `${env.PRIMARY_ORIGIN || 'http://localhost:3000'}/login`;
  const roleLabel = resolveRoleLabel(role);
  const greetingName = firstName?.trim() || 'there';

  const subject = `Your ${roleLabel} credentials`;
  const text = [
    `Hello ${greetingName},`,
    '',
    `An Umuganda SDA ${roleLabel.toLowerCase()} account has been created for you.`,
    `Visit ${loginUrl} and sign in with:`,
    `Username: ${username}`,
    `Temporary password: ${password}`,
    '',
    'For security, please sign in and change this password immediately.',
    '',
    'If you did not expect this email, contact your administrator.',
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <p style="font-size: 1rem;">Hello ${greetingName},</p>
      <p>An Umuganda SDA ${roleLabel.toLowerCase()} account has been created for you.</p>
      <p style="margin-bottom: 12px;">Use the credentials below to sign in:</p>
      <div style="background: #f7fafc; padding: 16px; border-radius: 8px; line-height: 1.6;">
        <div><strong>Username:</strong> ${username}</div>
        <div><strong>Temporary password:</strong> ${password}</div>
      </div>
      <p style="margin: 16px 0;">Visit <a href="${loginUrl}" style="color: #2b6cb0;">${loginUrl}</a> to sign in and please change this password immediately after logging in.</p>
      <p style="color: #4a5568; font-size: 0.95rem;">If you did not expect this email, contact your administrator.</p>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};
