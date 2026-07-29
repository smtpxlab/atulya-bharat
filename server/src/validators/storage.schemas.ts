import { z } from "zod";

export const bucketParamSchema = z.object({ bucket: z.string().min(1) });

export const objectParamSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
});

export const signedUrlQuerySchema = z.object({
  expiresIn: z.coerce.number().int().min(30).max(3600).optional(),
});

export const signedUploadBodySchema = z.object({
  path: z.string().min(1),
  contentType: z.string().min(1),
  expiresIn: z.number().int().min(30).max(3600).optional(),
});

export const deleteManyBodySchema = z.object({
  paths: z.array(z.string().min(1)).min(1).max(100),
});
