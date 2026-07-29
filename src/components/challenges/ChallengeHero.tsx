import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isChallengeExpired, formatExpiryDate } from "@/lib/challengeStatus";
import type { Challenge } from "@/types/challenge";

type Props = {
  challenge: Challenge;
  startingPrice: number | null;
  shortDescription: string;
  onBook: () => void;
  isBooked?: boolean;
};

export const ChallengeHero = ({ challenge }: Pick<Props, "challenge">) => {
  return (
    <section className="relative isolate overflow-hidden bg-muted">
      <div className="relative h-[320px] md:h-[420px] lg:h-[480px]">
        {challenge.cover_image_url ? (
          <img
            src={challenge.cover_image_url}
            alt={`${challenge.name} cover`}
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
          />
        ) : (
          <div className="grad-hero absolute inset-0" />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"
        />
        <div className="abr-container relative h-full flex flex-col justify-end pb-10 md:pb-14">
          <h1 className="font-display font-bold text-white text-3xl md:text-5xl lg:text-6xl leading-tight max-w-4xl">
            {challenge.name}
          </h1>
        </div>
      </div>
    </section>
  );
};

/** Info card extracted from the hero — render at top of details. */
export const ChallengeInfoCard = ({
  challenge,
  onBook,
  isBooked,
}: Props) => (
  <div className="abr-container mt-6 md:mt-8">
    <div className="flex flex-wrap items-center gap-3">
      {(() => {
        const expired = isChallengeExpired(challenge.end_at);
        if (expired) {
          return (
            <div className="flex flex-col gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="lg"
                        variant="secondary"
                        disabled
                        className="rounded-sm px-7 min-h-11"
                      >
                        Expired
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>This challenge has expired.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <p className="text-xs text-muted-foreground">
                Challenge ended on {formatExpiryDate(challenge.end_at)}.
              </p>
            </div>
          );
        }
        if (isBooked) {
          return (
            <>
              <Button
                size="lg"
                variant="secondary"
                disabled
                className="rounded-sm px-7 min-h-11"
              >
                Booked ✓
              </Button>
              <Button asChild variant="link" className="px-2">
                <Link to="/dashboard/challenges">View My Booking</Link>
              </Button>
            </>
          );
        }
        return (
          <button onClick={onBook} className="btn-saffron h-auto">
            Join Challenge
          </button>
        );
      })()}
    </div>
  </div>
);

