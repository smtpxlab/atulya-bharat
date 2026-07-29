/**
 * Email templates (minimal, brand-consistent).
 * Each function returns `{ subject, html, text }`.
 */
import { env } from "../../config/env";

const BRAND = "#FF6B1A";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const mini = (s: string) => s.replace(/\n\s*/g, "").replace(/\s{2,}/g, " ").trim();

function shell(inner: string, preview: string) {
  return mini(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(preview)}</title></head>
<body style="margin:0;padding:24px 12px;background:#fff;font-family:Inter,Arial,sans-serif;color:#1f2937;">
<div style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preview)}</div>
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;">${inner}</div>
</body></html>`);
}

export function passwordResetEmail(link: string) {
  return {
    subject: "Reset your Atulya Bharat Run password",
    html: shell(mini(`
      <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND};">Reset your password</h1>
      <p>Someone (hopefully you) asked to reset your password. Click the link below within 30 minutes to continue.</p>
      <p style="margin:20px 0;"><a href="${esc(link)}" style="background:${BRAND};color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Reset password</a></p>
      <p style="font-size:12px;color:#6b7280;">If you didn't request this, you can safely ignore this email.</p>
    `), "Reset your Atulya Bharat Run password"),
    text: `Reset your Atulya Bharat Run password: ${link}\n\nIf you didn't request this, ignore this email.`,
  };
}

export function emailVerification(link: string) {
  return {
    subject: "Verify your email — Atulya Bharat Run",
    html: shell(mini(`
      <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND};">Confirm your email address</h1>
      <p>Welcome to Atulya Bharat Run. Please confirm your email to activate your account.</p>
      <p style="margin:20px 0;"><a href="${esc(link)}" style="background:${BRAND};color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;">Verify email</a></p>
    `), "Verify your email"),
    text: `Verify your email: ${link}`,
  };
}

export function contactInternal(d: {
  name: string; email: string; phone: string; subject: string; message: string; submittedAt: string; ip: string;
}) {
  return {
    subject: "New Contact Form Submission - Atulya Bharat Run",
    html: shell(mini(`
      <h1 style="margin:0 0 12px;font-size:18px;color:${BRAND};">New contact enquiry</h1>
      <div style="font-size:14px;line-height:1.6;">
        <div><b>Name:</b> ${esc(d.name)}</div>
        <div><b>Email:</b> ${esc(d.email)}</div>
        <div><b>Phone:</b> ${esc(d.phone || "—")}</div>
        <div><b>Subject:</b> ${esc(d.subject)}</div>
        <div style="margin-top:8px;color:#6b7280;">Message:</div>
        <div style="background:#f5f5f7;border-radius:8px;padding:12px;margin-top:4px;white-space:pre-wrap;">${esc(d.message)}</div>
        <div style="margin-top:12px;font-size:12px;color:#9ca3af;">Submitted ${esc(d.submittedAt)} · IP ${esc(d.ip)}</div>
      </div>
    `), `New contact enquiry from ${d.name}`),
    text: `New contact enquiry\n\nName: ${d.name}\nEmail: ${d.email}\nPhone: ${d.phone || "—"}\nSubject: ${d.subject}\n\n${d.message}\n\nSubmitted ${d.submittedAt} · IP ${d.ip}`,
  };
}

export function contactAcknowledgement(d: { name: string; subject: string; message: string }) {
  return {
    subject: "Thank you for contacting Atulya Bharat Run",
    html: shell(mini(`
      <h1 style="margin:0 0 12px;font-size:20px;color:${BRAND};">Thank you, ${esc(d.name)}</h1>
      <p>Thank you for reaching out to Atulya Bharat Run. We have received your enquiry and our team will review it shortly.</p>
      <p style="color:#6b7280;font-size:13px;margin:16px 0 6px;">Your message:</p>
      <div style="background:#f5f5f7;border-radius:8px;padding:16px;">
        <div style="font-weight:600;">${esc(d.subject)}</div>
        <div style="color:#374151;white-space:pre-wrap;">${esc(d.message)}</div>
      </div>
      <p style="margin-top:16px;">We typically respond within 24–48 business hours.</p>
      <p style="font-size:12px;color:#6b7280;margin-top:24px;"><a href="${esc(env.SITE_URL)}" style="color:#6b7280;">${esc(env.SITE_URL)}</a></p>
    `), "We received your message"),
    text: `Hi ${d.name},\n\nThank you for reaching out to Atulya Bharat Run. We have received your enquiry.\n\nSubject: ${d.subject}\n${d.message}\n\nWe typically respond within 24–48 business hours.\n\n${env.SITE_URL}`,
  };
}

export function genericNotification(subject: string, bodyHtml: string, bodyText: string) {
  return {
    subject,
    html: shell(bodyHtml, subject),
    text: bodyText,
  };
}
