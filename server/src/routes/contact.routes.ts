import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { getDb } from "../config/db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { listQuerySchema, paginate, ok } from "../utils/list";
import { dispatchMail } from "../services/email/mailer.service";
import { contactAcknowledgement, contactInternal } from "../services/email/templates";
import { env } from "../config/env";
import { logger } from "../config/logger";

const TABLE = "contact_enquiries";
const router = Router();

const stripCtl = (s: string) => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

const contactInput = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().default(""),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(3000),
  website: z.string().optional().default(""), // honeypot
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
});

router.post(
  "/",
  contactLimiter,
  validate(contactInput),
  asyncHandler(async (req, res) => {
    const data = req.body as z.infer<typeof contactInput>;

    // Honeypot — silently accept & drop.
    if (data.website && data.website.trim().length > 0) {
      res.json({ success: true, message: "Your message has been sent successfully." });
      return;
    }

    const ip = (req.header("x-forwarded-for") ?? req.ip ?? "").split(",")[0]!.trim() || "unknown";
    const ua = (req.header("user-agent") ?? "").slice(0, 500);

    const clean = {
      name: stripCtl(data.name),
      email: stripCtl(data.email).toLowerCase(),
      phone: stripCtl(data.phone),
      subject: stripCtl(data.subject),
      message: stripCtl(data.message),
    };

    const phoneLine = clean.phone ? `\n\nPhone: ${clean.phone}` : "";
    await getDb()(TABLE)
      .insert({
        name: clean.name,
        email: clean.email,
        subject: clean.subject,
        message: clean.message + phoneLine,
        submitter_ip: ip,
        user_agent: ua,
      })
      .catch((err) => logger.error({ err }, "contact_enquiries insert failed"));

    const submittedAt =
      new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";

    const internal = contactInternal({ ...clean, submittedAt, ip });
    const ack = contactAcknowledgement(clean);
    const receiver = env.CONTACT_RECEIVER || env.SUPPORT_EMAIL;

    try {
      await Promise.all([
        dispatchMail({
          to: receiver,
          subject: internal.subject,
          html: internal.html,
          text: internal.text,
          replyTo: `${clean.name} <${clean.email}>`,
        }),
        dispatchMail({
          to: clean.email,
          subject: ack.subject,
          html: ack.html,
          text: ack.text,
          replyTo: env.SUPPORT_EMAIL,
          headers: {
            "Auto-Submitted": "auto-replied",
            "List-Unsubscribe": `<mailto:${env.SUPPORT_EMAIL}?subject=unsubscribe>`,
          },
        }),
      ]);
    } catch (err) {
      logger.error({ err }, "contact form email dispatch failed");
      throw new HttpError(502, "EMAIL_SEND_FAILED", "Unable to send your message. Please try again later.");
    }

    res.json({ success: true, message: "Your message has been sent successfully." });
  }),
);

// Admin
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const { q, page, pageSize } = req.query as unknown as z.infer<typeof listQuerySchema>;
    const qb = getDb()(TABLE).select("*").orderBy("created_at", "desc");
    if (q) qb.where((b) => b.whereILike("name", `%${q}%`).orWhereILike("email", `%${q}%`));
    res.json(ok(await paginate(qb, page, pageSize)));
  }),
);

router.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    const row = await getDb()(TABLE).where({ id: req.params.id }).first();
    if (!row) throw HttpError.notFound();
    res.json(ok(row));
  }),
);

router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  asyncHandler(async (req, res) => {
    await getDb()(TABLE).where({ id: req.params.id }).del();
    res.status(204).send();
  }),
);

export default router;
