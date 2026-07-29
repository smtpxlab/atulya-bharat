import { describe, it, expect } from "vitest";
import { validateUpload, extensionFor } from "../services/storage/validation";
import { BUCKETS, getBucket, isBucket, toObjectKey } from "../services/storage/buckets";

describe("storage buckets", () => {
  it("preserves all Supabase bucket names", () => {
    for (const name of [
      "club-logos",
      "blog-images",
      "challenge-covers",
      "challenge-assets",
      "gallery",
      "milestone-images",
      "milestone-audio",
      "participation-photos",
    ]) {
      expect(isBucket(name)).toBe(true);
      expect(getBucket(name).name).toBe(name);
    }
  });

  it("composes stable object keys", () => {
    expect(toObjectKey("gallery", "a/b.jpg")).toBe("gallery/a/b.jpg");
    expect(toObjectKey("gallery", "/a/b.jpg")).toBe("gallery/a/b.jpg");
  });

  it("exports every bucket", () => {
    expect(Object.keys(BUCKETS).length).toBeGreaterThanOrEqual(8);
  });
});

describe("storage validation", () => {
  it("accepts allowed image types", () => {
    expect(() =>
      validateUpload({ bucket: "gallery", mimeType: "image/jpeg", size: 1024 }),
    ).not.toThrow();
  });

  it("rejects wrong mime for audio bucket", () => {
    expect(() =>
      validateUpload({ bucket: "milestone-audio", mimeType: "image/png", size: 1024 }),
    ).toThrow();
  });

  it("rejects oversize files", () => {
    expect(() =>
      validateUpload({ bucket: "club-logos", mimeType: "image/png", size: 999_000_000 }),
    ).toThrow();
  });

  it("rejects unsupported image mime", () => {
    expect(() =>
      validateUpload({ bucket: "gallery", mimeType: "image/tiff", size: 1024 }),
    ).toThrow();
  });

  it("maps extensions", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
    expect(extensionFor("audio/mpeg")).toBe("mp3");
    expect(extensionFor("application/x-unknown", "bin")).toBe("bin");
  });
});
