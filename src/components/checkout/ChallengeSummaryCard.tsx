import type { Challenge, ChallengeTicket } from "@/types/challenge";
import { stripHtml } from "@/lib/utils";

type Props = {
  challenge: Challenge;
  ticket: ChallengeTicket | null;
  activityMode: string;
  durationDays: number | "";
};

export const ChallengeSummaryCard = ({
  challenge,
  ticket,
  activityMode,
  durationDays,
}: Props) => {
  const short = stripHtml(challenge.description ?? "").slice(0, 140);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      {challenge.cover_image_url && (
        <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
          <img
            src={challenge.cover_image_url}
            alt={challenge.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <div className="p-5">
        <h3 className="font-display text-lg text-navy">{challenge.name}</h3>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
          {challenge.challenge_type} · {challenge.distance} km
        </p>
        {short && (
          <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{short}</p>
        )}

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Ticket</dt>
            <dd className="font-medium text-foreground">
              {ticket?.ticket_name ?? "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Activity</dt>
            <dd className="font-medium text-foreground capitalize">
              {activityMode || "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="font-medium text-foreground">
              {durationDays ? `${durationDays} days` : "—"}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Price</dt>
            <dd className="font-semibold text-primary">
              {ticket ? `₹${ticket.ticket_price}` : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
};
