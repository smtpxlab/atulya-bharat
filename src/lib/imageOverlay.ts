// Canvas helpers for client-side share/BIB/certificate rendering.

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}

export async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export type TextLayer = {
  text: string;
  /** 0..1 of canvas width */
  x: number;
  /** 0..1 of canvas height */
  y: number;
  /** Either a CSS font shorthand sized for `width` (1080) or use sizePct. */
  font?: string;
  /** Font size as fraction of canvas height. Takes priority over `font`. */
  sizePct?: number;
  weight?: "normal" | "bold";
  family?: string;
  color: string;
  align?: CanvasTextAlign;
  /** Max text width as fraction of canvas width. */
  maxWidth?: number;
  /** Optional white text shadow for readability over busy templates. */
  shadow?: boolean;
};

function applyLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, w: number, h: number) {
  if (layer.sizePct) {
    const px = Math.round(h * layer.sizePct);
    const family = layer.family ?? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.font = `${layer.weight ?? "normal"} ${px}px ${family}`;
  } else {
    ctx.font = layer.font ?? "32px sans-serif";
  }
  ctx.textAlign = layer.align ?? "center";
  ctx.textBaseline = "middle";
  if (layer.shadow) {
    ctx.shadowColor = "rgba(255,255,255,0.85)";
    ctx.shadowBlur = Math.round(h * 0.01);
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  }
  ctx.fillStyle = layer.color;
  const x = Math.round(layer.x * w);
  const y = Math.round(layer.y * h);
  if (layer.maxWidth) {
    ctx.fillText(layer.text, x, y, Math.round(layer.maxWidth * w));
  } else {
    ctx.fillText(layer.text, x, y);
  }
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
}

export async function renderTemplate(
  templateUrl: string,
  layers: TextLayer[],
  width = 1080,
): Promise<HTMLCanvasElement> {
  const bg = await loadImage(templateUrl);
  const aspect = bg.height / bg.width;
  const w = width;
  const h = Math.round(width * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bg, 0, 0, w, h);
  for (const layer of layers) applyLayer(ctx, layer, w, h);
  return canvas;
}

/** Render a circular user-photo overlay onto a creative template. */
export async function renderShareCard(opts: {
  templateUrl: string;
  photoUrl: string | null;
  cx: number; cy: number; r: number;
  scale: number; offsetX: number; offsetY: number; rotation: number;
  layers: TextLayer[];
  width?: number;
}): Promise<HTMLCanvasElement> {
  const { templateUrl, photoUrl, cx, cy, r, scale, offsetX, offsetY, rotation, layers } = opts;
  const w = opts.width ?? 1080;
  const bg = await loadImage(templateUrl);
  const aspect = bg.height / bg.width;
  const h = Math.round(w * aspect);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bg, 0, 0, w, h);

  if (photoUrl) {
    const photo = await loadImage(photoUrl);
    const radius = r * Math.min(w, h);
    const centerX = cx * w;
    const centerY = cy * h;
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.translate(centerX + offsetX * radius, centerY + offsetY * radius);
    ctx.rotate((rotation * Math.PI) / 180);
    const base = (radius * 2) * scale;
    const ratio = photo.width / photo.height;
    const dw = ratio >= 1 ? base * ratio : base;
    const dh = ratio >= 1 ? base : base / ratio;
    ctx.drawImage(photo, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  for (const layer of layers) applyLayer(ctx, layer, w, h);
  return canvas;
}
