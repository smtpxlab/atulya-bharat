import { Router, raw as rawParser } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { logger } from "../config/logger";
import {
  applyWebhookEvent,
  createOrder,
  refundPayment,
  verifyAndRecordPayment,
  verifyWebhookSignature,
} from "../services/payments/razorpay.service";
import { requireRole } from "../middleware/requireRole";

const router = Router();

const createOrderSchema = z.object({
  challenge_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  activity_mode: z.string().optional(),
  target_days: z.number().int().positive().nullable().optional(),
  coupon_code: z.string().trim().min(1).nullable().optional(),
});

router.post(
  "/razorpay/orders",
  requireAuth,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createOrderSchema>;
    const result = await createOrder({
      userId: req.user!.sub,
      challengeId: body.challenge_id,
      ticketId: body.ticket_id,
      activityMode: body.activity_mode,
      targetDays: body.target_days ?? null,
      couponCode: body.coupon_code ?? null,
    });
    res.status(201).json({ data: result });
  }),
);

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
  challenge_id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  activity_mode: z.string().optional(),
  target_days: z.number().int().positive().nullable().optional(),
  coupon_code: z.string().trim().min(1).nullable().optional(),
});

router.post(
  "/razorpay/verify",
  requireAuth,
  validate(verifySchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof verifySchema>;
    const result = await verifyAndRecordPayment({ userId: req.user!.sub, ...body });
    res.json({ data: result });
  }),
);

/**
 * Razorpay webhook — the raw body is required to compute the HMAC signature.
 * Mounted with `express.raw` here so `req.body` is a Buffer.
 */
router.post(
  "/razorpay/webhook",
  rawParser({ type: "*/*", limit: "1mb" }),
  asyncHandler(async (req, res) => {
    const signature = req.header("x-razorpay-signature");
    if (!signature) throw new HttpError(401, "MISSING_SIGNATURE", "Missing signature");
    const raw = (req.body as Buffer).toString("utf8");
    if (!verifyWebhookSignature(raw, signature)) {
      logger.warn("razorpay webhook: invalid signature");
      throw new HttpError(401, "INVALID_SIGNATURE", "Invalid signature");
    }
    const payload = JSON.parse(raw);
    const result = await applyWebhookEvent(payload);
    res.json(result);
  }),
);

const refundSchema = z.object({
  payment_id: z.string().min(1),
  amount_paise: z.number().int().positive().optional(),
  notes: z.record(z.string()).optional(),
});

router.post(
  "/razorpay/refund",
  requireAuth,
  requireRole("admin"),
  validate(refundSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof refundSchema>;
    const refund = await refundPayment(body.payment_id, body.amount_paise, body.notes);
    res.json({ data: refund });
  }),
);

export default router;
