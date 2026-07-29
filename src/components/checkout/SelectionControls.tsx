import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Challenge, ChallengeTicket } from "@/types/challenge";

type Props = {
  challenge: Challenge;
  tickets: ChallengeTicket[];
  activityOptions: string[];
  activityMode: string;
  onActivityChange: (v: string) => void;
  ticketId: string;
  onTicketChange: (id: string) => void;
  durationDays: number | "";
  onDurationChange: (v: number | "") => void;
  durationError?: string;
};

export const SelectionControls = ({
  challenge,
  tickets,
  activityOptions,
  activityMode,
  onActivityChange,
  ticketId,
  onTicketChange,
  durationDays,
  onDurationChange,
  durationError,
}: Props) => {
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-lg text-navy">Your selections</h2>

      {activityOptions.length > 1 && (
        <div className="space-y-2">
          <Label>Select Challenge Type</Label>
          <div className="flex flex-wrap gap-2">
            {activityOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onActivityChange(opt)}
                className={cn(
                  "min-h-11 rounded-full border px-4 text-sm transition",
                  activityMode === opt
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/60",
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Select Ticket Type</Label>
        <div className="grid gap-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTicketChange(t.id)}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-xl border px-4 py-3 text-left transition",
                ticketId === t.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-background hover:border-primary/40",
              )}
            >
              <span className="text-sm font-medium text-foreground">
                {t.ticket_name}
              </span>
              <span className="text-sm font-semibold text-primary">
                ₹{t.ticket_price}
              </span>
            </button>
          ))}
          {!tickets.length && (
            <p className="text-sm text-muted-foreground">
              No tickets available for this challenge.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">
          Maximum Duration To Complete This Challenge:{" "}
          {challenge.max_duration_days
            ? `${challenge.max_duration_days} Days`
            : "—"}
        </Label>
        <Input
          id="duration"
          type="number"
          inputMode="numeric"
          min={1}
          max={challenge.max_duration_days ?? undefined}
          placeholder="Enter number of days"
          value={durationDays}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") onDurationChange("");
            else {
              const n = Number(raw);
              onDurationChange(Number.isFinite(n) ? n : "");
            }
          }}
          className="rounded-xl"
        />
        {durationError && (
          <p className="text-xs text-destructive">{durationError}</p>
        )}
      </div>
    </section>
  );
};
