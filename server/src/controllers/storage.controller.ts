import type { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { HttpError } from "../utils/httpError";
import { storageService } from "../services/storage/storage.service";
import { BUCKETS } from "../services/storage/buckets";
import {
  deleteManyBodySchema,
  signedUploadBodySchema,
  signedUrlQuerySchema,
} from "../validators/storage.schemas";

export const listBuckets = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ buckets: Object.values(BUCKETS) });
});

export const uploadObject = asyncHandler(async (req: Request, res: Response) => {
  const { bucket } = req.params;
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) throw new HttpError(400, "NO_FILE", "No file uploaded (field: file)");
  const upsert = req.query.upsert === "true";
  const path = typeof req.body?.path === "string" ? req.body.path : undefined;

  const result = await storageService.upload({
    bucket,
    path,
    body: file.buffer,
    contentType: file.mimetype,
    upsert,
  });
  res.status(201).json({ data: result });
});

export const deleteObject = asyncHandler(async (req: Request, res: Response) => {
  const { bucket, path } = req.params as { bucket: string; path: string };
  await storageService.delete(bucket, decodeURIComponent(path));
  res.status(204).end();
});

export const deleteMany = asyncHandler(async (req: Request, res: Response) => {
  const { bucket } = req.params;
  const body = deleteManyBodySchema.parse(req.body);
  await storageService.deleteMany(bucket, body.paths);
  res.status(204).end();
});

export const getPublicUrl = asyncHandler(async (req: Request, res: Response) => {
  const { bucket, path } = req.params as { bucket: string; path: string };
  const url = storageService.getPublicUrl(bucket, decodeURIComponent(path));
  if (!url) throw new HttpError(404, "NO_PUBLIC_URL", "No public URL available for this bucket");
  res.json({ data: { url } });
});

export const createSignedUrl = asyncHandler(async (req: Request, res: Response) => {
  const { bucket, path } = req.params as { bucket: string; path: string };
  const { expiresIn } = signedUrlQuerySchema.parse(req.query);
  const url = await storageService.createSignedUrl(bucket, decodeURIComponent(path), expiresIn);
  res.json({ data: { url, expiresIn: expiresIn ?? 300 } });
});

export const createSignedUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { bucket } = req.params;
  const body = signedUploadBodySchema.parse(req.body);
  const result = await storageService.createSignedUploadUrl(
    bucket,
    body.path,
    body.contentType,
    body.expiresIn,
  );
  res.status(201).json({ data: result });
});
