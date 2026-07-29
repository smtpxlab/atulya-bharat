import { Router } from "express";
import { health, live, ready, version } from "../controllers/health.controller";

const router = Router();

router.get("/health", health);
router.get("/live", live);
router.get("/ready", ready);
router.get("/version", version);

export default router;
