import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Upload, Download, Share2, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { renderShareCard, downloadCanvas, canvasToBlob } from "@/lib/imageOverlay";
import {
  uploadParticipationPhoto,
  removeParticipationPhoto,
} from "@/services/participationPhoto.service";
import { toast } from "sonner";

type Props = {
  templateUrl: string | null;
  challengeName: string;
  registrationId: string;
  userId: string;
  initialPhotoUrl: string | null;
  onPhotoChange?: () => void;
};

export function ParticipationShareCard({
  templateUrl,
  challengeName,
  registrationId,
  userId,
  initialPhotoUrl,
  onPhotoChange,
}: Props) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(initialPhotoUrl);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPhotoUrl(initialPhotoUrl);
  }, [initialPhotoUrl]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const url = await uploadParticipationPhoto({ userId, registrationId, file: f });
      setPhotoUrl(url);
      toast.success("Photo saved");
      onPhotoChange?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not save photo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setUploading(true);
    try {
      await removeParticipationPhoto({ userId, registrationId });
      setPhotoUrl(null);
      setZoom(1);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
      toast.success("Photo removed");
      onPhotoChange?.();
    } catch (err: any) {
      toast.error(err?.message ?? "Could not remove photo");
    } finally {
      setUploading(false);
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!photoUrl) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / 100;
    const dy = (e.clientY - dragRef.current.startY) / 100;
    setOffset({ x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy });
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleExport = async (mode: "download" | "share") => {
    if (!templateUrl) {
      toast.error("Challenge creative image is not configured");
      return;
    }
    setBusy(true);
    try {
      const canvas = await renderShareCard({
        templateUrl,
        photoUrl,
        cx: 0.5, cy: 0.4, r: 0.22,
        scale: zoom, offsetX: offset.x, offsetY: offset.y, rotation,
        layers: [],
      });
      if (mode === "download") {
        downloadCanvas(canvas, `${challengeName.replace(/\s+/g, "-")}-share.png`);
      } else {
        const blob = await canvasToBlob(canvas);
        const file = new File([blob], "share.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: challengeName });
        } else {
          downloadCanvas(canvas, `${challengeName.replace(/\s+/g, "-")}-share.png`);
        }
      }
    } catch {
      toast.error("Could not generate image. Try a different photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="section-share" className="space-y-3">
      <h2 className="font-display text-2xl text-navy">Share Your Participation</h2>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div
          className="relative mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border border-border bg-muted touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {templateUrl ? (
            <img
              src={templateUrl}
              alt="Challenge creative"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              No creative template uploaded
            </div>
          )}
          {photoUrl && (
            <div
              className="absolute overflow-hidden rounded-full border-4 border-white shadow-lg"
              style={{
                width: "44%",
                aspectRatio: "1 / 1",
                left: "28%",
                top: "26%",
              }}
            >
              <img
                src={photoUrl}
                alt="Your photo"
                draggable={false}
                className="pointer-events-none"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `translate(${offset.x * 50}%, ${offset.y * 50}%) scale(${zoom}) rotate(${rotation}deg)`,
                  transformOrigin: "center",
                }}
              />
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />

          {!photoUrl ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Upload photo
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Replace
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          )}

          {photoUrl && (
            <>
              <Control label={`Zoom · ${zoom.toFixed(2)}x`}>
                <Slider min={0.5} max={3} step={0.05} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
              </Control>
              <Control label={`Rotation · ${rotation}°`}>
                <Slider min={-180} max={180} step={1} value={[rotation]} onValueChange={(v) => setRotation(v[0])} />
              </Control>
              <p className="text-[11px] text-muted-foreground">Drag the preview to reposition.</p>
            </>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button onClick={() => handleExport("download")} disabled={busy} size="sm">
              <Download className="mr-2 h-3.5 w-3.5" /> Download
            </Button>
            <Button variant="outline" onClick={() => handleExport("share")} disabled={busy} size="sm">
              <Share2 className="mr-2 h-3.5 w-3.5" /> Share
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
