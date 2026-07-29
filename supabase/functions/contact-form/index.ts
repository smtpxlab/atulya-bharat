import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().default(""),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(3000),
  website: z.string().optional().default(""), // honeypot
});

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
   .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const stripCtl = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

// Force ASCII-only email subjects to avoid RFC 2047 quoted-printable encoding
// that some clients render as `=?utf-8?Q?...?=`.
const sanitizeSubject = (s: string) =>
  s.replace(/[\u2014\u2013]/g, "-")  // em/en dash -> hyphen
   .replace(/[\u2018\u2019]/g, "'")  // smart single quotes
   .replace(/[\u201C\u201D]/g, '"')  // smart double quotes
   .replace(/[\u2022]/g, "-")        // bullet
   .replace(/[^\x20-\x7E]/g, "")     // drop anything non-ASCII-printable
   .replace(/\s+/g, " ")
   .trim();

const BRAND = "#FF6B1A";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://atulyabharatrun.com";
const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") ?? "support@atulyabharatrun.com";
const FROM_NAME = Deno.env.get("MAIL_FROM_NAME") ?? "Atulya Bharat Run";
const FROM_EMAIL = Deno.env.get("MAIL_FROM_EMAIL") ?? Deno.env.get("SMTP_USER")!;

const REPLY_TO = Deno.env.get("REPLY_TO") ?? SUPPORT_EMAIL;
const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

// Collapse indentation/newlines to a single line — prevents quoted-printable
// from emitting `=20` for trailing spaces at end of wrapped lines.
const mini = (s: string) => s.replace(/\n\s*/g, "").replace(/\s{2,}/g, " ").trim();

const shell = (bodyInner: string, preview: string) => mini(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(preview)}</title></head>
<body style="margin:0;padding:24px 12px;background:#ffffff;font-family:Inter,Arial,sans-serif;color:#1f2937;-webkit-text-size-adjust:100%;">
<div style="display:none!important;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preview)}</div>
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px;">${bodyInner}</div>
</body></html>`);

const footerLine = mini(`<p style="margin:24px 0 0;font-size:12px;color:#6b7280;">
<a href="${esc(SITE_URL)}" style="color:#6b7280;text-decoration:none;">${esc(SITE_HOST)}</a> &middot;
<a href="mailto:${esc(SUPPORT_EMAIL)}" style="color:#6b7280;text-decoration:none;">${esc(SUPPORT_EMAIL)}</a>
</p>`);

const internalHtml = (d: { name: string; email: string; phone: string; subject: string; message: string; submitted_at: string; ip: string }) => shell(mini(`
<h1 style="margin:0 0 12px;font-size:18px;color:${BRAND};">New contact enquiry</h1>
<p style="margin:0 0 16px;color:#4b5563;font-size:14px;">A new message was submitted through the website contact form.</p>
<div style="font-size:14px;line-height:1.6;">
<div><span style="color:#6b7280;">Name:</span> <strong>${esc(d.name)}</strong></div>
<div><span style="color:#6b7280;">Email:</span> <a href="mailto:${esc(d.email)}" style="color:${BRAND};text-decoration:none;">${esc(d.email)}</a></div>
<div><span style="color:#6b7280;">Phone:</span> ${esc(d.phone || "—")}</div>
<div><span style="color:#6b7280;">Subject:</span> ${esc(d.subject)}</div>
<div style="margin-top:8px;color:#6b7280;">Message:</div>
<div style="background:#f5f5f7;border-radius:8px;padding:12px;margin-top:4px;white-space:pre-wrap;color:#1f2937;">${esc(d.message)}</div>
<div style="margin-top:12px;font-size:12px;color:#9ca3af;">Submitted ${esc(d.submitted_at)} &middot; IP ${esc(d.ip)}</div>
</div>
`), `New contact form submission from ${d.name}`);

const thankYouHtml = (d: { name: string; subject: string; message: string }) => shell(mini(`
<h1 style="margin:0 0 12px;font-size:20px;color:${BRAND};">Thank you, ${esc(d.name)}</h1>
<p style="margin:0 0 12px;color:#1f2937;font-size:14px;line-height:1.6;">Thank you for reaching out to Atulya Bharat Run. We have received your enquiry and our team will review it shortly.</p>
<p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Here is a copy of your message:</p>
<div style="background:#f5f5f7;border-radius:8px;padding:16px;margin:0 0 16px;font-size:14px;line-height:1.6;">
<div style="font-weight:600;color:#1f2937;margin-bottom:6px;">${esc(d.subject)}</div>
<div style="color:#374151;white-space:pre-wrap;">${esc(d.message)}</div>
</div>
<p style="margin:0 0 12px;color:#1f2937;font-size:14px;line-height:1.6;">We typically respond within 24&ndash;48 business hours. If your enquiry is urgent, simply reply to this email.</p>
<p style="margin:0;color:#1f2937;font-size:14px;">Best regards,<br/>Team Atulya Bharat Run</p>
${footerLine}
`), `We received your message — Atulya Bharat Run`);

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, message: "Method not allowed" });

  let raw: unknown;
  try { raw = await req.json(); } catch {
    return json(400, { success: false, message: "Invalid request body." });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { success: false, message: "Please check your inputs and try again." });
  }
  const data = parsed.data;

  // Honeypot — silent drop
  if (data.website && data.website.trim().length > 0) {
    return json(200, { success: true, message: "Your message has been sent successfully." });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const ua = req.headers.get("user-agent") ?? "";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Rate limit: 5 per IP per hour
  if (ip !== "unknown") {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: cntErr } = await supabase
      .from("contact_enquiries")
      .select("id", { count: "exact", head: true })
      .eq("submitter_ip", ip)
      .gte("created_at", since);
    if (!cntErr && (count ?? 0) >= 5) {
      console.warn("rate_limited", { ip_hash: ip.slice(0, 6) });
      return json(429, { success: false, message: "Too many requests. Please try again later." });
    }
  }

  const clean = {
    name: stripCtl(data.name),
    email: stripCtl(data.email).toLowerCase(),
    phone: stripCtl(data.phone),
    subject: stripCtl(data.subject),
    message: stripCtl(data.message),
  };

  // Audit insert
  const phoneLine = clean.phone ? `\n\nPhone: ${clean.phone}` : "";
  const { error: insErr } = await supabase.from("contact_enquiries").insert({
    name: clean.name,
    email: clean.email,
    subject: clean.subject,
    message: clean.message + phoneLine,
    submitter_ip: ip,
    user_agent: ua.slice(0, 500),
  });
  if (insErr) console.error("contact_enquiries insert failed:", insErr.message);

  // Send emails
  const submittedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";
  const internalText = `New contact enquiry\n\nName: ${clean.name}\nEmail: ${clean.email}\nPhone: ${clean.phone || "—"}\nSubject: ${clean.subject}\n\nMessage:\n${clean.message}\n\nSubmitted At: ${submittedAt}\nIP: ${ip}\nSource: Atulya Bharat Run Contact Form`;
  const thankYouText = `Hi ${clean.name},\n\nThank you for reaching out to Atulya Bharat Run.\n\nWe have received your enquiry and our team will review it shortly.\n\nHere is a copy of your message:\n\nSubject: ${clean.subject}\n\nMessage:\n${clean.message}\n\nWe typically respond within 24-48 business hours.\n\nIf your enquiry is urgent, simply reply to this email.\n\nBest regards,\n\nTeam Atulya Bharat Run\n\n${SITE_URL}\n${SUPPORT_EMAIL}`;

  // Gmail SMTP works most reliably over implicit TLS on 465 inside edge-runtime.
  // STARTTLS on 587 has known issues with denomailer here, so we prefer 465
  // unless the user explicitly overrides with a different port.
  const envPort = Number(Deno.env.get("SMTP_PORT") ?? "465");
  const smtpPort = envPort === 587 ? 465 : envPort;
  const smtp = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
      port: smtpPort,
      tls: smtpPort === 465,
      auth: {
        username: Deno.env.get("SMTP_USER")!,
        password: Deno.env.get("SMTP_PASS")!,
      },
    },
  });

  const fromHeader = `${FROM_NAME} <${FROM_EMAIL}>`;
  const receiver = Deno.env.get("CONTACT_RECEIVER")!;

  try {
    await smtp.send({
      from: fromHeader,
      to: receiver,
      replyTo: `${clean.name} <${clean.email}>`,
      subject: sanitizeSubject("New Contact Form Submission - Atulya Bharat Run"),
      content: internalText,
      html: internalHtml({ ...clean, submitted_at: submittedAt, ip }),
    });

    await smtp.send({
      from: fromHeader,
      to: clean.email,
      replyTo: REPLY_TO,
      subject: sanitizeSubject("Thank you for contacting Atulya Bharat Run"),
      content: thankYouText,
      html: thankYouHtml(clean),
      headers: {
        "List-Unsubscribe": `<mailto:${SUPPORT_EMAIL}?subject=unsubscribe>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        "Auto-Submitted": "auto-replied",
      },
    });

    await smtp.close();
  } catch (err) {
    try { await smtp.close(); } catch { /* noop */ }
    const msg = err instanceof Error ? err.message : "smtp error";
    console.error("SMTP send failed:", msg.replace(/(pass\w*|password)=\S+/gi, "$1=***"));
    return json(502, { success: false, message: "Unable to send your message. Please try again later." });
  }

  return json(200, { success: true, message: "Your message has been sent successfully." });
});
