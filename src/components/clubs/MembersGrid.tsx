import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";

type Member = {
  id: string;
  user_id: string;
  joined_at: string;
  role?: string;
  is_owner?: boolean;
  activities_count?: number;
  total_distance_km?: number;
  challenges_completed?: number;
  profile?: { full_name?: string | null; avatar_url?: string | null; city?: string | null } | null;
};

type Props = {
  members: Member[];
  clubName: string;
  initial?: number;
  step?: number;
};

export const MembersGrid = ({
  members,
  clubName,
  initial = 12,
  step = 12,
}: Props) => {
  const [shown, setShown] = useState(initial);

  if (!members.length) {
    return (
      <p className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No members yet — be the first to join.
      </p>
    );
  }

  const visible = members.slice(0, shown);
  const hasMore = shown < members.length;

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((m) => (
          <li
            key={m.id}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
          >
            <Avatar
              url={m.profile?.avatar_url ?? null}
              name={m.profile?.full_name ?? "Member"}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {m.profile?.full_name ?? "Member"}
                </p>
                {m.is_owner && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Owner
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {m.profile?.city ?? `Joined Club: ${clubName}`}
              </p>
              {(m.activities_count != null || m.total_distance_km != null) && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {Number(m.activities_count ?? 0)} activities ·{" "}
                  {Number(m.total_distance_km ?? 0).toFixed(1)} km ·{" "}
                  {Number(m.challenges_completed ?? 0)} completed
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setShown((n) => n + step)}
          >
            Load More
          </Button>
        </div>
      )}
    </>
  );
};
