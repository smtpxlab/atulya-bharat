import { HttpError } from "../../utils/httpError";
import { getBucket } from "./buckets";

export type UploadCandidate = {
  bucket: string;
  mimeType: string;
  size: number;
  filename?: string;
};

const IMAGE_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "image/avif",
]);
const AUDIO_MIME = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/m4a", "audio/x-m4a"]);

export function validateUpload(candidate: UploadCandidate): void {
  const b = getBucket(candidate.bucket);

  if (candidate.size <= 0) {
    throw new HttpError(400, "EMPTY_FILE", "Empty file");
  }
  if (candidate.size > b.maxBytes) {
    throw new HttpError(413, "FILE_TOO_LARGE", `File exceeds ${b.maxBytes} bytes`);
  }

  const ok = b.allowedMime.some((rule) =>
    rule.endsWith("/") ? candidate.mimeType.startsWith(rule) : candidate.mimeType === rule,
  );
  if (!ok) {
    throw new HttpError(415, "MIME_NOT_ALLOWED", `MIME type ${candidate.mimeType} not allowed for bucket ${b.name}`);
  }

  // Stricter allowlist per family
  if (candidate.mimeType.startsWith("image/") && !IMAGE_MIME.has(candidate.mimeType)) {
    throw new HttpError(415, "UNSUPPORTED_IMAGE", `Unsupported image type: ${candidate.mimeType}`);
  }
  if (candidate.mimeType.startsWith("audio/") && !AUDIO_MIME.has(candidate.mimeType)) {
    throw new HttpError(415, "UNSUPPORTED_AUDIO", `Unsupported audio type: ${candidate.mimeType}`);
  }
}

export function extensionFor(mimeType: string, fallback = "bin"): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "image/avif": "avif",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/ogg": "ogg",
    "audio/webm": "webm",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
  };
  return map[mimeType] ?? fallback;
}
