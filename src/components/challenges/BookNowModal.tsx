import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { toast } from "sonner";
import type { Challenge, ChallengeTicket } from "@/types/challenge";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  challenge: Challenge;
  tickets: ChallengeTicket[];
  /** ticket id to preselect when opened from PricingCards */
  preselectTicketId?: string | null;
};

const typeOptionsFor = (t: Challenge["challenge_type"]): string[] => {
  if (t === "Ride") return ["Ride"];
  if (t === "Run/Walk") return ["Run", "Walk"];
  return ["Run", "Walk", "Ride"];
};

export const BookNowModal = ({
  open,
  onOpenChange,
  challenge,
  tickets,
  preselectTicketId,
}: Props) => {
  const navigate = useNavigate();
  const typeOpts = typeOptionsFor(challenge.challenge_type);
  const [activity, setActivity] = useState<string>(typeOpts[0]);
  const [ticketId, setTicketId] = useState<string>(
    preselectTicketId ?? tickets[0]?.id ?? "",
  );
  const [duration, setDuration] = useState<number | "">("");

  useEffect(() => {
    if (open) {
      setActivity(typeOpts[0]);
      setTicketId(preselectTicketId ?? tickets[0]?.id ?? "");
      setDuration("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, preselectTicketId]);

  const maxDays = challenge.max_duration_days ?? null;

  const handleContinue = () => {
    if (!activity) return toast.error("Select challenge type");
    if (!ticketId) return toast.error("Select a ticket");
    if (duration === "" || !Number.isInteger(duration) || duration < 1) {
      return toast.error("Enter a valid duration");
    }
    if (maxDays && duration > maxDays) {
      return toast.error(`Duration must be ${maxDays} days or fewer`);
    }
    onOpenChange(false);
    const params = new URLSearchParams({
      activity,
      ticket: ticketId,
      days: String(duration),
    });
    navigate(`/challenges/${challenge.slug}/checkout?${params.toString()}`, {
      state: {
        challengeType: activity,
        ticketId,
        durationDays: duration,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Book {challenge.name}</DialogTitle>
          <DialogDescription>
            Confirm your activity, ticket and duration to continue.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="activity">Select Challenge Type</Label>
            <Select value={activity} onValueChange={setActivity}>
              <SelectTrigger id="activity" className="rounded-xl min-h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeOpts.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket">Select Ticket Type</Label>
            <Select value={ticketId} onValueChange={setTicketId}>
              <SelectTrigger id="ticket" className="rounded-xl min-h-11">
                <SelectValue placeholder="Choose a ticket" />
              </SelectTrigger>
              <SelectContent>
                {tickets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.ticket_name} — ₹{t.ticket_price}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="duration">
              Duration (days){maxDays ? ` · max ${maxDays}` : ""}
            </Label>
            <Input
              id="duration"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxDays ?? undefined}
              placeholder="Enter number of days"
              value={duration}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") setDuration("");
                else {
                  const n = Number(raw);
                  setDuration(Number.isFinite(n) ? n : "");
                }
              }}
              className="rounded-xl min-h-11"
            />
          </div>
        </div>

        <div className="mt-2">
          <Button onClick={handleContinue} className="w-full rounded-full min-h-11">
            Continue to Checkout
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
