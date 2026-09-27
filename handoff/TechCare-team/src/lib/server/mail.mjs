import nodemailer from 'nodemailer';
import { Problem } from './auth.mjs';
export async function sendMail(to, subject, text, demo) {
  if (demo) return;
  if (!process.env.TECHCARE_SMTP_HOST || !process.env.TECHCARE_SMTP_FROM)
    throw new Problem('Email delivery is not configured. Please contact the project team.', 503);
  const transport = nodemailer.createTransport({
    host: process.env.TECHCARE_SMTP_HOST,
    port: Number(process.env.TECHCARE_SMTP_PORT || 587),
    secure: false,
    requireTLS: true,
    connectionTimeout: 10000,
    socketTimeout: 10000,
    auth: process.env.TECHCARE_SMTP_USER
      ? { user: process.env.TECHCARE_SMTP_USER, pass: process.env.TECHCARE_SMTP_PASSWORD }
      : undefined,
  });
  try {
    await transport.sendMail({ from: process.env.TECHCARE_SMTP_FROM, to, subject, text });
  } catch {
    throw new Problem('Email could not be delivered. Please try again later.', 503);
  } finally {
    transport.close();
  }
}
