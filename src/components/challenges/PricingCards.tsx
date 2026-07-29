import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Award, Truck } from "lucide-react";
import type { ChallengeTicket } from "@/types/challenge";

type Props = {
  tickets: ChallengeTicket[];
  onSelect: (ticketId: string) => void;
};

const splitInclusions = (s: string | null) =>
  (s ?? "")
    .split(/\r?\n|•|·/)
    .map((x) => x.trim())
    .filter(Boolean);

export const PricingCards = ({ tickets, onSelect }: Props) => {
  if (!tickets.length) {
    return (
      <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Tickets will appear here once added.
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {tickets.map((t) => {
        const inclusions = splitInclusions(t.ticket_inclusions);
        return (
          <article
            key={t.id}
            className="flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
          >
            <h3 className="font-display text-lg text-navy">{t.ticket_name}</h3>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-display text-4xl text-navy">
                ₹{t.ticket_price}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="rounded-full border-success/30 text-success"
              >
                <Award className="mr-1 h-3 w-3" />
                Certificate: {t.allow_certificate ? "Yes" : "No"}
              </Badge>
              {t.shipping_cost > 0 && (
                <Badge variant="outline" className="rounded-full">
                  <Truck className="mr-1 h-3 w-3" />
                  Shipping ₹{t.shipping_cost}
                </Badge>
              )}
            </div>

            {inclusions.length > 0 && (
              <ul className="mt-5 space-y-2 text-sm text-foreground/90">
                {inclusions.map((it, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            )}

            <Button
              onClick={() => onSelect(t.id)}
              className="mt-6 w-full rounded-full min-h-11"
            >
              Select Ticket
            </Button>
          </article>
        );
      })}
    </div>
  );
};
