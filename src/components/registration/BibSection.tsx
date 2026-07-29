import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { renderTemplate, downloadCanvas, type TextLayer } from "@/lib/imageOverlay";
import { bibNumberFromRegistrationId } from "@/lib/bibNumber";
import {
  resolveBibOverlay,
  anchorTransform,
  canvasTextAlign,
  type OverlayAnchor,
} from "@/lib/bibOverlayConfig";
import { toast } from "sonner";

type Props = {
  templateUrl: string | null;
  athleteName: string;
  registrationId: string;
  registeredAt: string;
  distanceKm: number;
  challengeName: string;
  overlayConfig?: unknown;
  bibNumber?: string | null;
};

export function BibSection({
  templateUrl,
  athleteName,
  registrationId,
  registeredAt,
  distanceKm,
  challengeName,
  overlayConfig,
  bibNumber: bibNumberProp,
}: Props) {
  const [busy, setBusy] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [wrapH, setWrapH] = useState(0);
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapH(el.clientHeight));
    ro.observe(el);
    setWrapH(el.clientHeight);
    return () => ro.disconnect();
  }, [templateUrl]);
  const bibNumber = bibNumberProp || bibNumberFromRegistrationId(registrationId);
  const dateLabel = format(new Date(registeredAt), "d MMM yyyy");
  const cfg = resolveBibOverlay(overlayConfig);

  const entries: Array<{ anchor: OverlayAnchor; text: string }> = [
    { anchor: cfg.name, text: athleteName || "Athlete" },
    { anchor: cfg.bib, text: bibNumber },
    { anchor: cfg.date, text: dateLabel },
    { anchor: cfg.distance, text: `${distanceKm} KM` },
  ];

  const handleDownload = async () => {
    if (!templateUrl) {
      toast.error("BIB template not uploaded for this challenge");
      return;
    }
    setBusy(true);
    try {
      const layers: TextLayer[] = entries.map(({ anchor, text }) => ({
        text,
        x: anchor.x,
        y: anchor.y,
        sizePct: anchor.sizePct,
        weight: anchor.weight,
        color: anchor.color ?? "#0f172a",
        align: canvasTextAlign(anchor.align),
        maxWidth: anchor.maxWidthPct,
        shadow: true,
      }));
      const canvas = await renderTemplate(templateUrl, layers);
      downloadCanvas(canvas, `${bibNumber}-bib.png`);
    } catch {
      toast.error("Could not generate BIB");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="section-bib" className="space-y-4">
      <h2 className="font-display text-2xl text-navy">Your BIB</h2>

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative w-full bg-muted">
          {templateUrl ? (
            <div ref={wrapperRef} className="relative w-full">
              <img
                src={templateUrl}
                alt="BIB template"
                className="block w-full h-auto object-contain"
                onLoad={() => setWrapH(wrapperRef.current?.clientHeight ?? 0)}
              />
              {wrapH > 0 && entries.map(({ anchor, text }, i) => (
                <div
                  key={i}
                  className="absolute whitespace-nowrap leading-none"
                  style={{
                    left: `${anchor.x * 100}%`,
                    top: `${anchor.y * 100}%`,
                    transform: anchorTransform(anchor.align),
                    fontSize: `${Math.max(8, wrapH * (anchor.sizePct ?? 0.05))}px`,
                    fontWeight: anchor.weight === "bold" ? 700 : 400,
                    color: anchor.color ?? "#0f172a",
                    maxWidth: anchor.maxWidthPct ? `${anchor.maxWidthPct * 100}%` : undefined,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    textShadow: "0 1px 2px rgba(255,255,255,0.7), 0 0 6px rgba(255,255,255,0.4)",
                  }}
                >
                  {text}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid h-48 place-items-center text-sm text-muted-foreground">
              BIB template not uploaded
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">BIB · {challengeName}</div>
          <Button onClick={handleDownload} disabled={busy || !templateUrl} size="sm">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download BIB
          </Button>
        </div>
      </div>
    </section>
  );
}
