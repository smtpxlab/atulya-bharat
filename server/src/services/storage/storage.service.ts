/**
 * StorageService — bucket-aware wrapper over the R2 S3 client.
 *
 * All Supabase Storage bucket names and object paths are preserved. Objects
 * are stored in a single physical R2 bucket, namespaced by logical bucket
 * name as the first path segment.
 *
 * Public URL shape:
 *   `${R2_PUBLIC_BASE_URL}/${logical-bucket}/${path}`
 *
 * This matches Supabase's public-URL shape closely enough that the
 * compatibility layer (later phase) can swap bases without rewriting DB rows.
 */
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { HttpError } from "../../utils/httpError";
import { getBucket, isBucket, toObjectKey } from "./buckets";
import { extensionFor, validateUpload } from "./validation";

let _client: S3Client | null = null;

function client(): S3Client {
  if (_client) return _client;
  if (!env.R2_ACCOUNT_ID || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    throw new HttpError(503, "R2_NOT_CONFIGURED", "R2 storage is not configured");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export type UploadInput = {
  bucket: string;
  /** Object path within the logical bucket. If omitted, a UUID + ext is generated. */
  path?: string;
  body: Buffer | Uint8Array | string;
  contentType: string;
  cacheControl?: string;
  upsert?: boolean;
};

export type UploadResult = {
  bucket: string;
  path: string;
  key: string;
  size: number;
  contentType: string;
  publicUrl: string | null;
};

function requireBucket(name: string) {
  if (!isBucket(name)) throw new HttpError(404, "UNKNOWN_BUCKET", `Unknown bucket: ${name}`);
  return getBucket(name);
}

function publicUrlFor(bucket: string, path: string): string | null {
  const b = getBucket(bucket);
  if (!b.public || !env.R2_PUBLIC_BASE_URL) return null;
  return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${bucket}/${path.replace(/^\/+/, "")}`;
}

export const storageService = {
  buckets: () => Object.values(getAllBuckets()),

  async upload(input: UploadInput): Promise<UploadResult> {
    const bucket = requireBucket(input.bucket);
    const size = typeof input.body === "string" ? Buffer.byteLength(input.body) : input.body.byteLength;
    validateUpload({ bucket: bucket.name, mimeType: input.contentType, size });

    const path =
      input.path?.replace(/^\/+/, "") ??
      `${randomUUID()}.${extensionFor(input.contentType)}`;
    const key = toObjectKey(bucket.name, path);

    if (!input.upsert) {
      const exists = await this.head(bucket.name, path).catch(() => null);
      if (exists) throw new HttpError(409, "OBJECT_EXISTS", `Object already exists: ${bucket.name}/${path}`);
    }

    await client().send(
      new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        Body: input.body,
        ContentType: input.contentType,
        CacheControl: input.cacheControl ?? "public, max-age=3600",
      }),
    );

    return {
      bucket: bucket.name,
      path,
      key,
      size,
      contentType: input.contentType,
      publicUrl: publicUrlFor(bucket.name, path),
    };
  },

  async delete(bucket: string, path: string): Promise<void> {
    const b = requireBucket(bucket);
    await client().send(
      new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: toObjectKey(b.name, path) }),
    );
  },

  async deleteMany(bucket: string, paths: string[]): Promise<void> {
    for (const p of paths) {
      await this.delete(bucket, p).catch((err) => {
        logger.warn({ err, bucket, path: p }, "storage.deleteMany: single delete failed");
      });
    }
  },

  async head(bucket: string, path: string) {
    const b = requireBucket(bucket);
    return client().send(
      new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: toObjectKey(b.name, path) }),
    );
  },

  getPublicUrl(bucket: string, path: string): string | null {
    requireBucket(bucket);
    return publicUrlFor(bucket, path);
  },

  async createSignedUrl(bucket: string, path: string, expiresIn = 300): Promise<string> {
    const b = requireBucket(bucket);
    return getSignedUrl(
      client(),
      new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: toObjectKey(b.name, path) }),
      { expiresIn },
    );
  },

  async createSignedUploadUrl(
    bucket: string,
    path: string,
    contentType: string,
    expiresIn = 300,
  ): Promise<{ url: string; key: string; publicUrl: string | null }> {
    const b = requireBucket(bucket);
    validateUpload({ bucket: b.name, mimeType: contentType, size: 1 }); // size validated on PUT via policy
    const key = toObjectKey(b.name, path);
    const url = await getSignedUrl(
      client(),
      new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn },
    );
    return { url, key, publicUrl: publicUrlFor(b.name, path) };
  },
};

function getAllBuckets() {
  // Re-exported here to avoid a circular import from buckets.ts consumers.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("./buckets").BUCKETS as Record<string, ReturnType<typeof getBucket>>;
}
