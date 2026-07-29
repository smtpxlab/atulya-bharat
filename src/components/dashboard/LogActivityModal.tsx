import { useMemo, useState } from "react";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type LogActivityValues = {
  date: string;
  distance_km: number;
  activity_type: string;
  notes: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challengeTitle: string;
  allowedModes: string[];
  onSubmit: (values: LogActivityValues) => Promise<void>;
  /** Optional context for clamping and helpful hints */
  targetKm?: number;
  loggedKm?: number;
  minDate?: Date;
  maxDate?: Date;
};

const toIso = (d: Date) => format(d, "yyyy-MM-dd");

export const LogActivityModal = ({
  open,
  onOpenChange,
  challengeTitle,
  allowedModes,
  onSubmit,
  targetKm,
  loggedKm,
  minDate,
  maxDate,
}: Props) => {
  const types = (allowedModes.length ? allowedModes : ["run", "walk", "ride"]).filter(
    (m) => m !== "any",
  );
  const [date, setDate] = useState<Date>(new Date());
  const [distance, setDistance] = useState<string>("");
  const [activityType, setActivityType] = useState<string>(types[0] ?? "run");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = useMemo(() => {
    if (targetKm == null || loggedKm == null) return null;
    return Math.max(0, Number((targetKm - loggedKm).toFixed(2)));
  }, [targetKm, loggedKm]);

  const today = new Date();
  const effectiveMaxDate = maxDate && maxDate < today ? maxDate : today;
  const effectiveMinDate = minDate ?? new Date("2020-01-01");

  const reset = () => {
    setDate(new Date());
    setDistance("");
    setActivityType(types[0] ?? "run");
    setNotes("");
  };

  const handleSave = async () => {
    const km = Number(distance);
    if (!Number.isFinite(km) || km <= 0) return;
    setSaving(true);
    try {
      await onSubmit({ date: toIso(date), distance_km: km, activity_type: activityType, notes });
      reset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const fillRemaining = () => {
    if (remaining != null && remaining > 0) setDistance(String(remaining));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : (reset(), onOpenChange(v)))}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-navy">Log activity</DialogTitle>
          <DialogDescription>
            For {challengeTitle}
            {remaining != null && remaining > 0 && targetKm != null && (
              <span className="ml-1 text-foreground">
                · {remaining.toFixed(2)} km left to finish
              </span>
            )}
            {remaining === 0 && (
              <span className="ml-1 text-success">· target already reached</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="act-date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="act-date"
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  disabled={(d) => d > effectiveMaxDate || d < effectiveMinDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {(minDate || maxDate) && (
              <p className="text-[11px] text-muted-foreground">
                Allowed range: {format(effectiveMinDate, "d MMM yyyy")} –{" "}
                {format(effectiveMaxDate, "d MMM yyyy")}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="act-distance">Distance</Label>
              {remaining != null && remaining > 0 && (
                <button
                  type="button"
                  onClick={fillRemaining}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Fill remaining ({remaining.toFixed(2)} km)
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="act-distance"
                type="number"
                inputMode="decimal"
                min={0.01}
                max={targetKm ?? undefined}
                step={0.01}
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="pr-12"
                placeholder="0.00"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                km
              </span>
            </div>
            {targetKm != null && (
              <p className="text-[11px] text-muted-foreground">
                Max per activity: {targetKm} km
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Activity type</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-notes">Notes (optional)</Label>
            <Input
              id="act-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving || !distance} className="w-full">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save activity"
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
