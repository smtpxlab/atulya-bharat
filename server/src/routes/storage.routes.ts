import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import {
  createSignedUploadUrl,
  createSignedUrl,
  deleteMany,
  deleteObject,
  getPublicUrl,
  listBuckets,
  uploadObject,
} from "../controllers/storage.controller";

const router = Router();

// 25 MB hard cap at the multipart layer; per-bucket limits enforced in service.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.get("/buckets", listBuckets);

// Public URL lookup — no auth (mirrors Supabase getPublicUrl semantics).
router.get("/object/:bucket/public/:path(*)", getPublicUrl);

// Signed read URL — no auth by design; caller may add auth in front for private buckets.
router.get("/object/:bucket/signed/:path(*)", createSignedUrl);

// Mutations require authentication.
router.post("/object/:bucket", requireAuth, upload.single("file"), uploadObject);
router.post("/signed-upload/:bucket", requireAuth, createSignedUploadUrl);
router.delete("/object/:bucket/:path(*)", requireAuth, deleteObject);
router.post("/object/:bucket/delete-many", requireAuth, deleteMany);

export default router;
