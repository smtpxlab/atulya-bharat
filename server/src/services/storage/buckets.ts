/**
 * Logical bucket registry.
 *
 * Preserves the exact Supabase Storage bucket names and folder conventions so
 * the compatibility layer (activated in a later phase) can map calls 1:1
 * without touching database rows that store absolute URLs.
 *
 * All buckets live inside a single Cloudflare R2 bucket (env.R2_BUCKET),
 * namespaced by the logical bucket name as the first path segment:
 *     <logical-bucket>/<original-object-key>
 */

export type LogicalBucket = {
  /** Original Supabase bucket id — MUST NOT change. */
  name: string;
  /** Whether objects are served via the public R2 base URL. */
  public: boolean;
  /** Allowed MIME prefixes (e.g. "image/") or exact types. */
  allowedMime: string[];
  /** Max object size in bytes. */
  maxBytes: number;
};

export const BUCKETS = {
  "club-logos": {
    name: "club-logos",
    public: true,
    allowedMime: ["image/"],
    maxBytes: 5 * 1024 * 1024,
  },
  "blog-images": {
    name: "blog-images",
    public: true,
    allowedMime: ["image/"],
    maxBytes: 10 * 1024 * 1024,
  },
  "challenge-covers": {
    name: "challenge-covers",
    public: true,
    allowedMime: ["image/"],
    maxBytes: 10 * 1024 * 1024,
  },
  "challenge-assets": {
    name: "challenge-assets",
    public: true,
    allowedMime: ["image/"],
    maxBytes: 10 * 1024 * 1024,
  },
  gallery: {
    name: "gallery",
    public: true,
    allowedMime: ["image/"],
    maxBytes: 10 * 1024 * 1024,
  },
  "milestone-images": {
    name: "milestone-images",
    public: true,
    allowedMime: ["image/"],
    maxBytes: 10 * 1024 * 1024,
  },
  "milestone-audio": {
    name: "milestone-audio",
    public: true,
    allowedMime: ["audio/"],
    maxBytes: 25 * 1024 * 1024,
  },
  "participation-photos": {
    name: "participation-photos",
    public: true,
    allowedMime: ["image/"],
    maxBytes: 10 * 1024 * 1024,
  },
} as const satisfies Record<string, LogicalBucket>;

export type BucketName = keyof typeof BUCKETS;

export function getBucket(name: string): LogicalBucket {
  const b = (BUCKETS as Record<string, LogicalBucket>)[name];
  if (!b) throw new Error(`Unknown bucket: ${name}`);
  return b;
}

export function isBucket(name: string): name is BucketName {
  return name in BUCKETS;
}

/** Compose the physical R2 object key from a logical bucket + path. */
export function toObjectKey(bucket: string, path: string): string {
  const clean = path.replace(/^\/+/, "");
  return `${bucket}/${clean}`;
}
