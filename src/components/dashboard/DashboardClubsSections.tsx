import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  useMyCreatedClubs,
  useMyJoinedClubs,
} from "@/features/profile/hooks/useProfile";
import { useLeaveClub } from "@/features/clubs/hooks/useClubs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { EmptyState } from "@/components/clubs/EmptyState";
import { Plus, Users, ArrowUpRight, LogOut, Crown } from "lucide-react";
import type { DashboardClubRow } from "@/services/profile.service";

const StatusDot = ({ status }: { status: string }) => {
  const tone =
    status === "approved"
      ? "bg-success/15 text-success"
      : status === "pending"
      ? "bg-secondary/20 text-secondary-foreground"
      : "bg-destructive/15 text-destructive";
  return (
    <Badge className={`rounded-full border-0 ${tone} hover:opacity-90`}>
      {status}
    </Badge>
  );
};

const ClubRowCard = ({
  club,
  variant,
  onLeave,
  leavePending,
}: {
  club: DashboardClubRow;
  variant: "created" | "joined";
  onLeave?: (id: string) => void;
  leavePending?: boolean;
}) => (
  <article className="group flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-all duration-[250ms] hover:-translate-y-0.5 hover:shadow-card sm:flex-row sm:items-center sm:gap-4">
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl grad-warm text-primary-foreground shadow-soft">
      {variant === "created" ? (
        <Crown className="h-5 w-5" />
      ) : (
        <Users className="h-5 w-5" />
      )}
    </div>

    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <p className="truncate font-display text-base text-navy">{club.name}</p>
        {variant === "created" && <StatusDot status={club.status} />}
      </div>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">
        {club.promoter_name ? `by ${club.promoter_name}` : "—"}
      </p>
    </div>

    <div className="flex flex-shrink-0 items-center gap-2">
      <Button asChild size="sm" variant="outline" className="rounded-full">
        <Link to={`/clubs/${club.slug}`}>
          View <ArrowUpRight className="ml-1 h-3 w-3" />
        </Link>
      </Button>
      {variant === "joined" && onLeave && (
        <Button
          size="sm"
          variant="ghost"
          className="rounded-full text-muted-foreground hover:text-destructive"
          disabled={leavePending}
          onClick={() => onLeave(club.id)}
          aria-label={`Leave ${club.name}`}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      )}
    </div>
  </article>
);

export const DashboardClubsSections = () => {
  const { user } = useAuth();
  const created = useMyCreatedClubs();
  const joined = useMyJoinedClubs();
  const leave = useLeaveClub();

  const createdList = created.data ?? [];
  const joinedList = joined.data ?? [];

  return (
    <section className="card-elevated mt-10 p-6 md:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-display-3 text-navy">My Clubs</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Clubs you lead and communities you've joined.
          </p>
        </div>
        <Button asChild size="sm" className="rounded-full">
          <Link to="/clubs/create">
            <Plus className="mr-1.5 h-4 w-4" /> Create Club
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="created" className="mt-5">
        <TabsList className="rounded-full bg-muted p-1">
          <TabsTrigger value="created" className="rounded-full data-[state=active]:bg-background">
            Created
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
              {createdList.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="joined" className="rounded-full data-[state=active]:bg-background">
            Joined
            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold text-primary">
              {joinedList.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-5 space-y-3">
          {created.isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : createdList.length === 0 ? (
            <EmptyState
              icon={<Crown className="h-7 w-7" />}
              title="You haven't created any clubs yet."
              description="Start a community and bring fellow runners together."
              action={
                <Button asChild className="rounded-full">
                  <Link to="/clubs/create">
                    <Plus className="mr-1.5 h-4 w-4" /> Create your first club
                  </Link>
                </Button>
              }
            />
          ) : (
            createdList.map((c) => (
              <ClubRowCard key={c.id} club={c} variant="created" />
            ))
          )}
        </TabsContent>

        <TabsContent value="joined" className="mt-5 space-y-3">
          {joined.isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : joinedList.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="You haven't joined any clubs yet."
              description="Explore clubs and connect with the community."
              action={
                <Button asChild className="rounded-full">
                  <Link to="/clubs">Explore Clubs</Link>
                </Button>
              }
            />
          ) : (
            joinedList.map((c) => (
              <ClubRowCard
                key={c.id}
                club={c}
                variant="joined"
                leavePending={leave.isPending}
                onLeave={(id) => leave.mutate({ clubId: id, userId: user!.id })}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
};
