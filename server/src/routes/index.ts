import { Router } from "express";
import healthRoutes from "./health.routes";
import authRoutes from "./auth.routes";
import iamRoutes from "./iam.routes";
import profilesRoutes from "./profiles.routes";
import userRolesRoutes from "./user-roles.routes";
import challengesRoutes from "./challenges.routes";
import registrationsRoutes from "./registrations.routes";
import milestonesRoutes from "./milestones.routes";
import activitiesRoutes from "./activities.routes";
import ordersRoutes from "./orders.routes";
import couponsRoutes from "./coupons.routes";
import blogsRoutes from "./blogs.routes";
import pagesRoutes from "./pages.routes";
import galleryRoutes from "./gallery.routes";
import faqsRoutes from "./faqs.routes";
import testimonialsRoutes from "./testimonials.routes";
import notificationsRoutes from "./notifications.routes";
import clubsRoutes from "./clubs.routes";
import newsletterRoutes from "./newsletter.routes";
import contactRoutes from "./contact.routes";
import storageRoutes from "./storage.routes";
import paymentsRoutes from "./payments.routes";
import stravaRoutes from "./strava.routes";
import tablesRoutes from "./tables.routes";
import { sanitizeResponse } from "../middleware/sanitizeResponse";

const router = Router();

// Deep-strip secret fields (Strava tokens, gateway secrets) from all responses.
router.use(sanitizeResponse);

router.use(healthRoutes);
router.use("/auth", authRoutes);
router.use("/admin/iam", iamRoutes);
router.use("/profiles", profilesRoutes);
router.use("/user-roles", userRolesRoutes);
router.use("/challenges", challengesRoutes);
router.use("/registrations", registrationsRoutes);
router.use("/milestones", milestonesRoutes);
router.use("/activities", activitiesRoutes);
router.use("/orders", ordersRoutes);
router.use("/coupons", couponsRoutes);
router.use("/blogs", blogsRoutes);
router.use("/pages", pagesRoutes);
router.use("/gallery", galleryRoutes);
router.use("/faqs", faqsRoutes);
router.use("/testimonials", testimonialsRoutes);
router.use("/notifications", notificationsRoutes);
router.use("/clubs", clubsRoutes);
router.use("/newsletter", newsletterRoutes);
router.use("/contact", contactRoutes);
router.use("/storage", storageRoutes);
router.use("/payments", paymentsRoutes);
router.use("/strava", stravaRoutes);
// Generic PostgREST-compatible fallback used by the Supabase-shaped client shim.
router.use("/tables", tablesRoutes);

export default router;
