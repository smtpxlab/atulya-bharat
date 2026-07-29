import nodemailer, { Transporter } from "nodemailer";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

let transporter: Transporter | null = null;

export function getMailer(): Transporter | null {
  if (transporter) return transporter;
  if (!env.SMTP_HOST) {
    logger.warn("SMTP not configured");
    return null;
  }
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  return transporter;
}

export interface MailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export async function sendMail(opts: MailOptions) {
  const t = getMailer();
  if (!t) throw new Error("Mailer not configured");
  return t.sendMail({ from: opts.from ?? env.SMTP_FROM, ...opts });
}

/**
 * Enqueue an email through BullMQ if Redis is available; otherwise send
 * synchronously. Callers use this as the standard API.
 */
export async function dispatchMail(opts: MailOptions) {
  // Lazy import to avoid circular deps between queue and mailer.
  const { getQueue } = await import("../../jobs/queue");
  const q = getQueue("email");
  if (q) {
    await q.add("send", opts);
    return { queued: true };
  }
  await sendMail(opts);
  return { queued: false, sent: true };
}

export async function verifyMailer(): Promise<boolean> {
  const t = getMailer();
  if (!t) return false;
  try {
    await t.verify();
    return true;
  } catch (err) {
    logger.error({ err }, "SMTP verify failed");
    return false;
  }
}
