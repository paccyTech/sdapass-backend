import { Role } from "@prisma/client";
import { promises as fs } from "fs";
import nodemailer from "nodemailer";
import path from "path";
import { PDFDocument, PDFImage, rgb, StandardFonts } from "pdf-lib";

import { env } from "./env";

// Log environment variables for debugging
console.log('Email Config:', {
  hasUser: !!env.GMAIL_USER,
  hasPass: !!env.GMAIL_APP_PASSWORD,
  smtpHost: env.SMTP_HOST,
  smtpPort: env.SMTP_PORT,
  smtpSecure: env.SMTP_SECURE
});

// Create a simple in-memory email store for development
type MailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType?: string;
};

const devEmailStore: Array<{ to: string; subject: string; text: string; attachments?: MailAttachment[] }> = [];

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
  attachments?: MailAttachment[];
};

export const sendEmail = async ({ to, subject, text, html, attachments }: SendMailOptions) => {
  // In development without email config, store the email in memory
  if (!transporter) {
    console.warn("Email not sent - no email configuration. Storing in dev email store.");
    devEmailStore.push({ to, subject, text, attachments });
    console.log("Dev Email Store:", devEmailStore);
    return { success: true, devMode: true, stored: true };
  }

  const from = `"${env.GMAIL_FROM_NAME || "Umuganda SDA"}" <${env.GMAIL_USER}>`;
  
  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html: html || text,
      attachments,
    });
    
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    
    // In development, still store the email even if sending fails
    if (process.env.NODE_ENV !== "production") {
      devEmailStore.push({ to, subject, text, attachments });
      console.log("Email stored in dev store due to error:", { to, subject });
      return { success: true, devMode: true, error: "Email stored in dev mode", stored: true };
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

const escapeHtml = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

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

type SendMemberWelcomeEmailOptions = {
  to: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  password: string;
  nationalId: string;
  churchName?: string | null;
  loginUrl: string;
  passUrl: string;
  qrPayload: string;
  passToken: string;
};

const logoAssetPath = path.resolve(process.cwd(), "src/assets/sda-logo.png");
let cachedLogoBytes: Uint8Array | null = null;

const loadLogoBytes = async () => {
  if (cachedLogoBytes) {
    return cachedLogoBytes;
  }

  try {
    cachedLogoBytes = await fs.readFile(logoAssetPath);
  } catch (error) {
    console.error("Could not load SDA logo for PDF", error);
    cachedLogoBytes = null;
  }

  return cachedLogoBytes;
};

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value = parseInt(normalized, 16);

  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;

  return rgb(r / 255, g / 255, b / 255);
};

const buildMemberPassPdf = async ({
  firstName,
  lastName,
  phoneNumber,
  nationalId,
  churchName,
  qrPayload,
  passToken,
}: Pick<SendMemberWelcomeEmailOptions, "firstName" | "lastName" | "phoneNumber" | "churchName" | "qrPayload" | "passToken" | "nationalId">) => {
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 672;
  const pageHeight = 432;
  const cardWidth = 576;
  const cardHeight = 336;
  const cardX = (pageWidth - cardWidth) / 2;
  const cardY = (pageHeight - cardHeight) / 2;

  const midnight = hexToRgb("#020617");
  const frontHeader = hexToRgb("#0f172a");
  const frontBorder = hexToRgb("#1e293b");
  const frontBody = hexToRgb("#f8fafc");
  const frontText = hexToRgb("#1e293b");
  const mutedText = hexToRgb("#94a3b8");
  const slate = hexToRgb("#475569");
  const highlight = hexToRgb("#64748b");
  const badgeBlue = hexToRgb("#1e3a8a");
  const backPanel = hexToRgb("#101c3a");
  const backSection = hexToRgb("#12274f");
  const white = rgb(1, 1, 1);

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let logoImage: PDFImage | null = null;
  try {
    const logoBytes = await loadLogoBytes();
    if (logoBytes) {
      logoImage = await pdfDoc.embedPng(logoBytes);
    }
  } catch (logoError) {
    console.error("Could not embed SDA logo", logoError);
  }

  const drawParagraph = (
    page: Parameters<typeof pdfDoc.addPage>[0] extends infer _T ? any : never,
    text: string,
    {
      x,
      y,
      maxWidth,
      lineHeight,
      font,
      size,
      color,
    }: {
      x: number;
      y: number;
      maxWidth: number;
      lineHeight: number;
      font: typeof regularFont;
      size: number;
      color: ReturnType<typeof rgb>;
    },
  ) => {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    lines.forEach((line, index) => {
      page.drawText(line, {
        x,
        y: y - index * lineHeight,
        size,
        font,
        color,
      });
    });

    const totalHeight = (lines.length - 1) * lineHeight;
    return y - totalHeight;
  };

  const initials = `${(firstName?.[0] ?? "").toUpperCase()}${(lastName?.[0] ?? "").toUpperCase()}`.trim() || "RM";
  const displayName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Umuganda Member";
  const churchLabel = churchName ?? "Church assignment pending";
  const phoneLabel = phoneNumber || "Not provided";
  const qrData = qrPayload.startsWith("data:image") ? qrPayload.split(",")[1] : null;

  const drawFrontCard = async (page: any) => {
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: midnight });

    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: frontBody,
      borderColor: frontBorder,
      borderWidth: 1.2,
      opacity: 0.98,
    });

    const headerHeight = 80;
    page.drawRectangle({
      x: cardX,
      y: cardY + cardHeight - headerHeight,
      width: cardWidth,
      height: headerHeight,
      color: frontHeader,
    });

    let headerTextX = cardX + 36;
    const headerTextY = cardY + cardHeight - headerHeight / 2 + 8;

    if (logoImage) {
      const targetHeight = 44;
      const targetWidth = (logoImage.width / logoImage.height) * targetHeight;
      page.drawImage(logoImage, {
        x: cardX + 32,
        y: headerTextY - targetHeight / 2,
        width: targetWidth,
        height: targetHeight,
      });
      headerTextX += targetWidth + 24;
    }

    page.drawText("RWANDA UNION MISSION", {
      x: headerTextX,
      y: headerTextY + 14,
      size: 20,
      font: boldFont,
      color: white,
    });

    page.drawText("OFFICIAL UMUGANDA PASS", {
      x: headerTextX,
      y: headerTextY - 10,
      size: 12,
      font: regularFont,
      color: mutedText,
    });

    const leftColumnX = cardX + 40;
    const contentTop = cardY + cardHeight - headerHeight - 40;
    const badgeRadius = 40;
    const badgeCenterX = leftColumnX + badgeRadius;
    const badgeCenterY = contentTop - badgeRadius + 6;

    page.drawCircle({ x: badgeCenterX, y: badgeCenterY, size: badgeRadius, color: badgeBlue });
    const initialsWidth = boldFont.widthOfTextAtSize(initials, 22);
    page.drawText(initials, {
      x: badgeCenterX - initialsWidth / 2,
      y: badgeCenterY - 8,
      size: 22,
      font: boldFont,
      color: white,
    });

    const nameX = leftColumnX + badgeRadius * 2 + 24;
    page.drawText(displayName, {
      x: nameX,
      y: contentTop - 6,
      size: 20,
      font: boldFont,
      color: frontText,
    });

    page.drawText("Community Service Member", {
      x: nameX,
      y: contentTop - 28,
      size: 12,
      font: regularFont,
      color: highlight,
    });

    const detailStartY = contentTop - 60;
    const lineSpacing = 30;
    const detailLabels: Array<{ label: string; value: string }> = [
      { label: "Church", value: churchLabel },
      { label: "National ID", value: nationalId || "Not provided" },
      { label: "Phone number", value: phoneLabel },
      { label: "Member pass", value: passToken },
    ];

    detailLabels.forEach(({ label, value }, index) => {
      const y = detailStartY - lineSpacing * index;
      page.drawText(label.toUpperCase(), {
        x: leftColumnX,
        y,
        size: 10,
        font: boldFont,
        color: highlight,
      });
      page.drawText(value, {
        x: leftColumnX,
        y: y - 16,
        size: 13,
        font: regularFont,
        color: frontText,
      });
    });

    const qrBoxWidth = 190;
    const qrBoxHeight = 190;
    const qrBoxX = cardX + cardWidth - qrBoxWidth - 48;
    const qrBoxY = cardY + 68;

    page.drawRectangle({
      x: qrBoxX,
      y: qrBoxY,
      width: qrBoxWidth,
      height: qrBoxHeight,
      color: white,
      borderColor: mutedText,
      borderWidth: 1,
      opacity: 0.92,
    });

    if (qrData) {
      try {
        const qrBytes = Buffer.from(qrData, "base64");
        const qrImage = await pdfDoc.embedPng(qrBytes);
        const qrSize = Math.min(qrBoxWidth - 36, qrBoxHeight - 48);
        page.drawImage(qrImage, {
          x: qrBoxX + (qrBoxWidth - qrSize) / 2,
          y: qrBoxY + (qrBoxHeight - qrSize) / 2 + 12,
          width: qrSize,
          height: qrSize,
        });
      } catch (qrError) {
        console.error("Unable to embed QR code in pass PDF", qrError);
        page.drawText("QR unavailable", {
          x: qrBoxX + 36,
          y: qrBoxY + qrBoxHeight / 2,
          size: 12,
          font: regularFont,
          color: mutedText,
        });
      }
    } else {
      page.drawText("QR unavailable", {
        x: qrBoxX + 36,
        y: qrBoxY + qrBoxHeight / 2,
        size: 12,
        font: regularFont,
        color: mutedText,
      });
    }

    page.drawText("OFFICIAL SCAN", {
      x: qrBoxX + 54,
      y: qrBoxY + 16,
      size: 11,
      font: boldFont,
      color: highlight,
    });

    drawParagraph(page, "Official Rwanda Union Mission pass. Present with your national ID on Umuganda day. Non-transferable — report misuse, loss, or damage immediately.", {
      x: cardX + 40,
      y: cardY + 44,
      maxWidth: cardWidth - 80,
      lineHeight: 12,
      font: regularFont,
      size: 10,
      color: slate,
    });
  };

  const drawBackCard = (page: any) => {
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: midnight });

    page.drawRectangle({
      x: cardX,
      y: cardY,
      width: cardWidth,
      height: cardHeight,
      color: backPanel,
      borderColor: frontBorder,
      borderWidth: 1.2,
    });

    page.drawRectangle({
      x: cardX,
      y: cardY + cardHeight - 72,
      width: cardWidth,
      height: 72,
      color: frontHeader,
    });

    let headerTextX = cardX + 36;
    if (logoImage) {
      const targetHeight = 40;
      const targetWidth = (logoImage.width / logoImage.height) * targetHeight;
      page.drawImage(logoImage, {
        x: cardX + 32,
        y: cardY + cardHeight - 52,
        width: targetWidth,
        height: targetHeight,
      });
      headerTextX += targetWidth + 24;
    }

    page.drawText("RWANDA UNION MISSION", {
      x: headerTextX,
      y: cardY + cardHeight - 24,
      size: 18,
      font: boldFont,
      color: white,
    });

    page.drawText("Community Service Identification", {
      x: cardX + 40,
      y: cardY + cardHeight - 96,
      size: 14,
      font: boldFont,
      color: white,
    });

    page.drawText("Member Obligations & Verification", {
      x: cardX + 40,
      y: cardY + cardHeight - 116,
      size: 11,
      font: regularFont,
      color: highlight,
    });

    const columnWidth = (cardWidth - 120) / 2;
    const columnHeight = 140;
    const columnY = cardY + cardHeight - 168 - columnHeight;

    page.drawRectangle({
      x: cardX + 40,
      y: columnY,
      width: columnWidth,
      height: columnHeight,
      color: backSection,
    });

    page.drawRectangle({
      x: cardX + 80 + columnWidth,
      y: columnY,
      width: columnWidth,
      height: columnHeight,
      color: backSection,
    });

    page.drawText("Usage Guidelines", {
      x: cardX + 48,
      y: columnY + columnHeight - 24,
      size: 12,
      font: boldFont,
      color: white,
    });

    drawParagraph(page, "Carry this pass with your national ID during Umuganda activities. Provide both documents when verification is requested. Keep the pass clean and legible. Damaged credentials must be returned to your church administrator for replacement.", {
      x: cardX + 48,
      y: columnY + columnHeight - 44,
      maxWidth: columnWidth - 20,
      lineHeight: 12,
      font: regularFont,
      size: 10,
      color: mutedText,
    });

    const complianceX = cardX + 88 + columnWidth;
    page.drawText("Compliance Notice", {
      x: complianceX,
      y: columnY + columnHeight - 24,
      size: 12,
      font: boldFont,
      color: white,
    });

    drawParagraph(page, "Property of the Seventh-day Adventist Church – Rwanda Union Mission. Any alteration, duplication, lending, or misuse voids this pass and may result in disciplinary or legal action. Update your contact details with your church administrator within 48 hours of any change.", {
      x: complianceX,
      y: columnY + columnHeight - 44,
      maxWidth: columnWidth - 20,
      lineHeight: 12,
      font: regularFont,
      size: 10,
      color: mutedText,
    });

    const contactBlockHeight = 96;
    const contactY = cardY + 64;
    page.drawRectangle({
      x: cardX + 40,
      y: contactY,
      width: cardWidth - 80,
      height: contactBlockHeight,
      color: backSection,
    });

    page.drawText("Union Contact", {
      x: cardX + 52,
      y: contactY + contactBlockHeight - 26,
      size: 12,
      font: boldFont,
      color: white,
    });

    page.drawText("KN 123 St, Kigali · Tel +250 788 000 000", {
      x: cardX + 52,
      y: contactY + contactBlockHeight - 50,
      size: 11,
      font: regularFont,
      color: mutedText,
    });

    page.drawText("support@umuganda.rw · Report lost or stolen passes immediately.", {
      x: cardX + 52,
      y: contactY + contactBlockHeight - 70,
      size: 11,
      font: regularFont,
      color: mutedText,
    });

    page.drawText("Keep this credential with your national ID. Return the pass within 7 days if you transfer to another church.", {
      x: cardX + 52,
      y: contactY + 16,
      size: 10,
      font: regularFont,
      color: mutedText,
    });
  };

  const frontPage = pdfDoc.addPage([pageWidth, pageHeight]);
  await drawFrontCard(frontPage);

  const backPage = pdfDoc.addPage([pageWidth, pageHeight]);
  drawBackCard(backPage);

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
};

export const sendMemberWelcomeEmail = async ({
  to,
  firstName,
  lastName,
  phoneNumber,
  password,
  nationalId,
  churchName,
  loginUrl,
  passUrl,
  qrPayload,
  passToken,
}: SendMemberWelcomeEmailOptions) => {
  const subject = "Your Umuganda SDA member credentials";
  const greeting = firstName?.trim() ? firstName.trim() : "there";
  const text = [
    `Hello ${greeting},`,
    "",
    "Welcome to the Umuganda SDA community service platform.",
    "",
    "Log in using the member portal:",
    `Phone number: ${phoneNumber}`,
    `Password: ${password}`,
    `Link: ${loginUrl}`,
    "",
    `National ID: ${nationalId}`,
    "",
    "You can always access your digital pass here:",
    passUrl,
    "",
    "A PDF copy of your official Umuganda pass is attached for printing.",
    "",
    "Keep this information secure and change the password after your first sign-in.",
  ].join("\n");

  let attachments: MailAttachment[] | undefined;
  try {
    const pdfBuffer = await buildMemberPassPdf({
      firstName,
      lastName,
      phoneNumber,
      nationalId,
      churchName,
      qrPayload,
      passToken,
    });

    attachments = [
      {
        filename: `Umuganda-pass-${passToken}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];
  } catch (pdfError) {
    console.error("Failed to generate member pass PDF", pdfError);
  }

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#0f172a;padding:32px;color:#e2e8f0;">
      <div style="max-width:720px;margin:0 auto;background:#0f172a;border-radius:28px;padding:32px;">
        <p style="margin:0 0 12px 0;font-size:18px;font-weight:600;">Hello ${escapeHtml(greeting)},</p>
        <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;color:#cbd5f5;">
          Your Umuganda SDA member account has been created by your church administrator. Use the credentials below to sign in
          and download your digital pass ahead of the next community service day.
        </p>
        <div style="background:rgba(15,23,42,0.65);border:1px solid rgba(148,163,184,0.35);border-radius:20px;padding:20px 24px;margin-bottom:24px;">
          <div style="font-size:13px;letter-spacing:0.18em;text-transform:uppercase;color:#94a3b8;font-weight:600;margin-bottom:12px;">Member credentials</div>
          <div style="display:flex;flex-wrap:wrap;gap:16px;color:#f8fafc;font-size:15px;">
            <div style="flex:1 1 220px;">
              <div style="color:#94a3b8;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Phone number</div>
              <div style="font-weight:600;">${escapeHtml(phoneNumber)}</div>
            </div>
            <div style="flex:1 1 220px;">
              <div style="color:#94a3b8;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:4px;">Password</div>
              <div style="font-weight:600;">${escapeHtml(password)}</div>
            </div>
            <div style="flex:1 1 220px;">
              <div style="color:#94a3b8;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:4px;">Login link</div>
              <a href="${loginUrl}" style="color:#38bdf8;font-weight:600;text-decoration:none;">${escapeHtml(loginUrl)}</a>
            </div>
          </div>
          <div style="margin-top:18px;font-size:13px;color:#cbd5f5;">National ID: <strong>${escapeHtml(nationalId)}</strong></div>
          <div style="margin-top:4px;font-size:12px;color:#94a3b8;">A printable PDF with front and back card layouts is attached.</div>
        </div>
        <div style="background:rgba(15,23,42,0.45);border-radius:18px;padding:20px 24px;color:#e2e8f0;">
          <p style="margin:0 0 10px 0;font-size:14px;line-height:1.6;">
            Print the attached card on both sides and carry it together with your national ID on Umuganda day. Present both documents
            when verification is requested.
          </p>
          <p style="margin:0;font-size:13px;color:#94a3b8;">
            If you did not expect this email, contact your church administrator immediately.
          </p>
        </div>
      </div>
    </div>
  `;

  return sendEmail({
    to,
    subject,
    text,
    html,
    attachments,
  });
};
