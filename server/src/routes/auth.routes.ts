import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authController } from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth";
import { csrfProtection } from "../middleware/csrf";
import { validate } from "../middleware/validate";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "../validators/auth.schemas";

const router = Router();

// The refresh token lives in a cookie, so every state-changing auth route
// needs double-submit CSRF verification.
router.use(csrfProtection);

// Tight per-IP limits on credential-sensitive endpoints.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
const strictLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/refresh", validate(refreshSchema), authController.refresh);
router.post("/logout", validate(logoutSchema), authController.logout);

router.post(
  "/forgot-password",
  strictLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
router.post(
  "/reset-password",
  strictLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);
router.post(
  "/change-password",
  requireAuth,
  authLimiter,
  validate(changePasswordSchema),
  authController.changePassword,
);

router.post("/verify-email", validate(verifyEmailSchema), authController.verifyEmail);
router.post(
  "/resend-verification",
  strictLimiter,
  validate(resendVerificationSchema),
  authController.resendVerification,
);

router.get("/me", requireAuth, authController.me);

// Session, device and login-history management for the signed-in user.
router.get("/sessions", requireAuth, authController.listSessions);
router.delete("/sessions", requireAuth, authController.revokeAllSessions);
router.delete("/sessions/:id", requireAuth, authController.revokeSession);
router.get("/devices", requireAuth, authController.listDevices);
router.delete("/devices/:id", requireAuth, authController.removeDevice);
router.get("/login-history", requireAuth, authController.loginHistory);

export default router;
