import { Router } from "express";
import { iamController } from "../controllers/iam.controller";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { csrfProtection } from "../middleware/csrf";
import { validate } from "../middleware/validate";
import { roleMutationSchema, setActiveSchema } from "../validators/auth.schemas";

/**
 * Admin Identity & Access Management.
 * Everything here is admin-gated; role grants are additionally restricted to
 * super_admin inside the controller.
 */
const router = Router();

router.use(csrfProtection, requireAuth, requireRole("admin"));

router.get("/users", iamController.listUsers);
router.patch("/users/:id/active", validate(setActiveSchema), iamController.setActive);
router.post("/users/:id/unlock", iamController.unlock);
router.post("/users/:id/force-password-reset", iamController.forcePasswordReset);
router.post("/users/:id/roles", validate(roleMutationSchema), iamController.grantRole);
router.delete("/users/:id/roles", validate(roleMutationSchema), iamController.revokeRole);
router.get("/users/:id/sessions", iamController.userSessions);
router.delete("/users/:id/sessions", iamController.revokeUserSessions);

router.get("/audit-logs", iamController.auditLogs);
router.get("/login-attempts", iamController.loginAttempts);

export default router;
