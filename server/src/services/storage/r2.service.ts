import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

let client: S3Client | null = null;

export function getR2Client(): S3Client | null {
  if (client) return client;
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY) {
    logger.warn("R2 credentials not configured");
    return null;
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

export async function putObject(key: string, body: Buffer | Uint8Array | string, contentType?: string) {
  const c = getR2Client();
  if (!c) throw new Error("R2 not configured");
  await c.send(
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
  return env.R2_PUBLIC_BASE_URL ? `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}` : key;
}

export async function presignGet(key: string, expiresIn = 300) {
  const c = getR2Client();
  if (!c) throw new Error("R2 not configured");
  return getSignedUrl(c, new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }), { expiresIn });
}

export async function presignPut(key: string, contentType?: string, expiresIn = 300) {
  const c = getR2Client();
  if (!c) throw new Error("R2 not configured");
  return getSignedUrl(
    c,
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export async function deleteObject(key: string) {
  const c = getR2Client();
  if (!c) throw new Error("R2 not configured");
  await c.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}
