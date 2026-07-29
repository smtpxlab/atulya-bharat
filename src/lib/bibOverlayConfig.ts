// Dynamic, dimension-independent overlay configuration for BIB templates.
// All positions and sizes are normalized (0..1) so that any admin-uploaded
// template image renders consistently regardless of its pixel dimensions.

export type OverlayAlign = "left" | "center" | "right";

export type OverlayAnchor = {
  /** Horizontal anchor, 0..1 of template width. */
  x: number;
  /** Vertical anchor, 0..1 of template height. */
  y: number;
  /** Text alignment relative to the anchor. */
  align?: OverlayAlign;
  /** Font size as a fraction of template height (e.g. 0.06 = 6% of height). */
  sizePct?: number;
  weight?: "normal" | "bold";
  color?: string;
  /** Max text width as a fraction of template width. */
  maxWidthPct?: number;
};

export type BibOverlayConfig = {
  name: OverlayAnchor;
  bib: OverlayAnchor;
  date: OverlayAnchor;
  distance: OverlayAnchor;
};

/**
 * Default overlay layout tuned for templates that leave the right-half empty
 * (e.g. the Atulya Bharat / Ayodhya BIB). Admins can override per-challenge
 * by storing a `bib_overlay_config` JSON object on the challenge row.
 */
export const DEFAULT_BIB_OVERLAY: BibOverlayConfig = {
  name: {
    x: 0.97,
    y: 0.28,
    align: "right",
    sizePct: 0.085,
    weight: "bold",
    color: "#0f172a",
    maxWidthPct: 0.55,
  },
  bib: {
    x: 0.97,
    y: 0.5,
    align: "right",
    sizePct: 0.1,
    weight: "bold",
    color: "#dc2626",
    maxWidthPct: 0.55,
  },
  date: {
    x: 0.97,
    y: 0.62,
    align: "right",
    sizePct: 0.05,
    weight: "normal",
    color: "#334155",
    maxWidthPct: 0.55,
  },
  distance: {
    x: 0.97,
    y: 0.73,
    align: "right",
    sizePct: 0.075,
    weight: "bold",
    color: "#0f172a",
    maxWidthPct: 0.55,
  },
};

export function resolveBibOverlay(raw: unknown): BibOverlayConfig {
  if (!raw || typeof raw !== "object") return DEFAULT_BIB_OVERLAY;
  const r = raw as Partial<BibOverlayConfig>;
  return {
    name: { ...DEFAULT_BIB_OVERLAY.name, ...(r.name ?? {}) },
    bib: { ...DEFAULT_BIB_OVERLAY.bib, ...(r.bib ?? {}) },
    date: { ...DEFAULT_BIB_OVERLAY.date, ...(r.date ?? {}) },
    distance: { ...DEFAULT_BIB_OVERLAY.distance, ...(r.distance ?? {}) },
  };
}

/** CSS `transform` to align an absolutely-positioned element to an anchor. */
export function anchorTransform(align: OverlayAlign = "center"): string {
  const tx = align === "left" ? "0%" : align === "right" ? "-100%" : "-50%";
  return `translate(${tx}, -50%)`;
}

/** Canvas `textAlign` mapped from our align field. */
export function canvasTextAlign(align: OverlayAlign = "center"): CanvasTextAlign {
  return align;
}
