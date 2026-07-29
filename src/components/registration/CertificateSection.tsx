import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2, Lock, Trophy } from "lucide-react";
import { differenceInDays, format } from "date-fns";
import { renderTemplate, downloadCanvas, type TextLayer } from "@/lib/imageOverlay";
import { toast } from "sonner";

type Props = {
  templateUrl: string | null;
  registrationId: string;
  athleteName: string;
  challengeName: string;
  distanceKm: number;
  registeredAt: string;
  completionDate: string | null;
  isComplete: boolean;
  distanceLoggedKm?: number;
  certificateNumber?: string | null;
};


type Anchor = {
  text: string;
  x: number;
  y: number;
  sizePct: number;
  weight?: "normal" | "bold";
  family?: string;
  color?: string;
  maxWidth?: number;
};

export function CertificateSection({
  templateUrl,
  registrationId,
  athleteName,
  challengeName,
  distanceKm,
  registeredAt,
  completionDate,
  isComplete,
  distanceLoggedKm = 0,
  certificateNumber: certificateNumberProp,
}: Props) {
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapH, setWrapH] = useState(0);

  const completedDate = useMemo(
    () => (completionDate ? new Date(completionDate) : new Date()),
    [completionDate],
  );
  const dateLabel = format(completedDate, "d MMM yyyy");
  const daysElapsed = Math.max(1, differenceInDays(completedDate, new Date(registeredAt)) || 1);
  // Certificate number is authoritative from DB only. If null, certificate is not yet issued
  // (registration not completed) and we must not render or download a fabricated number.
  const certNo = certificateNumberProp ?? null;
  const certIssued = isComplete && !!certNo;

  const anchors: Anchor[] = useMemo(
    () => [
      { text: athleteName || "Athlete", x: 0.5, y: 0.46, sizePct: 0.07, weight: "bold", family: "Georgia, 'Times New Roman', serif", color: "#0f172a", maxWidth: 0.7 },
      { text: challengeName, x: 0.5, y: 0.62, sizePct: 0.045, weight: "bold", color: "#0f172a", maxWidth: 0.6 },
      { text: `${distanceKm} KM`, x: 0.30, y: 0.80, sizePct: 0.032, weight: "bold", color: "#334155", maxWidth: 0.25 },
      { text: `${daysElapsed} Days`, x: 0.62, y: 0.80, sizePct: 0.032, weight: "bold", color: "#334155", maxWidth: 0.25 },
      { text: dateLabel, x: 0.36, y: 0.945, sizePct: 0.024, color: "#334155", maxWidth: 0.25 },
      { text: certNo ?? "", x: 0.72, y: 0.945, sizePct: 0.024, color: "#334155", maxWidth: 0.30 },
    ],
    [athleteName, challengeName, distanceKm, daysElapsed, dateLabel, certNo],
  );

  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const ro = new ResizeObserver(() => setWrapH(el.clientHeight));
    ro.observe(el);
    setWrapH(el.clientHeight);
    return () => ro.disconnect();
  }, [templateUrl, isComplete]);

  const handleDownload = async () => {
    if (!templateUrl) {
      toast.error("Certificate template not uploaded");
      return;
    }
    if (!certIssued) {
      toast.error("Certificate is not yet issued for this registration");
      return;
    }
    setBusy(true);
    try {
      const layers: TextLayer[] = anchors.map((a) => ({
        text: a.text,
        x: a.x,
        y: a.y,
        sizePct: a.sizePct,
        weight: a.weight,
        family: a.family,
        color: a.color ?? "#0f172a",
        maxWidth: a.maxWidth,
        align: "center",
      }));
      const canvas = await renderTemplate(templateUrl, layers, 1600);
      downloadCanvas(canvas, `${challengeName.replace(/\s+/g, "-")}-certificate.png`);
    } catch {
      toast.error("Could not generate certificate");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="section-certificate" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {certIssued ? (
            <Trophy className="h-6 w-6 text-success" />
          ) : (
            <Lock className="h-6 w-6 text-muted-foreground" />
          )}
          <h2 className="font-display text-2xl text-navy">Certificate</h2>
        </div>
        {certIssued && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
            <Trophy className="h-3.5 w-3.5" /> Challenge Completed
          </span>
        )}
      </div>

      <div
        className={`overflow-hidden rounded-2xl border bg-card ${certIssued ? "border-success/40" : "border-border"}`}
      >
        <div ref={wrapRef} className="relative w-full">
          {templateUrl ? (
            <img
              src={templateUrl}
              alt="Certificate template"
              crossOrigin="anonymous"
              className={`block w-full ${certIssued ? "" : "opacity-50 blur-[2px]"}`}
            />
          ) : (
            <div className="grid aspect-[16/10] w-full place-items-center text-sm text-muted-foreground">
              Certificate template not uploaded
            </div>
          )}

          {/* Live overlay text — only when certificate is issued */}
          {certIssued && templateUrl && wrapH > 0 && (
            <div className="pointer-events-none absolute inset-0">
              {anchors.map((a, i) => {
                const px = Math.max(8, wrapH * a.sizePct);
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: `${a.x * 100}%`,
                      top: `${a.y * 100}%`,
                      transform: "translate(-50%, -50%)",
                      fontSize: `${px}px`,
                      fontWeight: a.weight === "bold" ? 700 : 400,
                      fontFamily: a.family ?? "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                      color: a.color ?? "#0f172a",
                      maxWidth: a.maxWidth ? `${a.maxWidth * 100}%` : undefined,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textAlign: "center",
                      lineHeight: 1.1,
                    }}
                  >
                    {a.text}
                  </div>
                );
              })}
            </div>
          )}

          {/* Locked overlay */}
          {!certIssued && (
            <div className="absolute inset-0 grid place-items-center bg-background/40 p-6 text-center">
              <div className="max-w-sm space-y-2 rounded-xl bg-card/95 p-5 shadow-lg ring-1 ring-border">
                <Lock className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="font-display text-lg text-navy">Certificate locked</p>
                <p className="text-sm text-muted-foreground">
                  {isComplete && !certNo
                    ? "Your certificate is being issued. Please refresh in a moment."
                    : "Complete the challenge to unlock your certificate."}
                </p>
                <p className="text-xs font-medium text-foreground">
                  {distanceLoggedKm.toFixed(1)} / {distanceKm} KM logged
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-card p-3">
          <div className="text-xs text-muted-foreground">
            {certIssued ? `Awarded · ${dateLabel} · ${certNo}` : "Available after completion"}
          </div>
          {certIssued && (
            <Button onClick={handleDownload} disabled={busy || !templateUrl}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Download Certificate
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
