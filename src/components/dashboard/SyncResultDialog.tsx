import { CheckCircle2, AlertTriangle, Clock, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type SyncResult = {
  imported: number;
  fetched: number;
  duplicate: number;
  outsideWindow: number;
  wrongSport: number;
  activityMode?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: SyncResult | null;
};

export function SyncResultDialog({ open, onOpenChange, result }: Props) {
  if (!result) return null;
  const {
    imported,
    fetched,
    duplicate,
    outsideWindow,
    wrongSport,
    activityMode,
  } = result;
  const mode = (activityMode ?? "").toLowerCase();
  const modeLabel = mode === "run" ? "Run" : mode === "walk" ? "Walk" : mode === "ride" ? "Ride/Cycling" : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Strava sync result</DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <p className="text-sm text-muted-foreground">
            Checked <span className="font-semibold text-foreground">{fetched}</span> recent
            {fetched === 1 ? " activity" : " activities"} from Strava.
          </p>

          <ul className="mt-4 space-y-2 text-sm">
            <Row
              icon={<CheckCircle2 className="h-4 w-4 text-success" />}
              label="Imported"
              value={imported}
              tone="success"
            />
            <Row
              icon={<Copy className="h-4 w-4 text-muted-foreground" />}
              label="Already imported"
              value={duplicate}
            />
            <Row
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
              label="Outside challenge window"
              value={outsideWindow}
            />
            <Row
              icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
              label={
                modeLabel
                  ? `Skipped — challenge accepts ${modeLabel} only`
                  : "Skipped — wrong sport"
              }
              value={wrongSport}
              tone={wrongSport > 0 ? "warning" : undefined}
            />
          </ul>

          {wrongSport > 0 && (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {wrongSport} {wrongSport === 1 ? "activity was" : "activities were"} skipped
              because their sport doesn't match your registration
              {modeLabel ? ` (${modeLabel} only)` : ""}. They will not count toward this
              challenge.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="rounded-full">
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "success" | "warning";
}) {
  const valueColor =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-amber-600"
        : "text-foreground";
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-foreground">
        {icon}
        {label}
      </span>
      <span className={`font-display text-lg ${valueColor}`}>{value}</span>
    </li>
  );
}
