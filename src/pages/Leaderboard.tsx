import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/Avatar";
import { Medal, Trophy } from "lucide-react";
import { format } from "date-fns";
import { SEO } from "@/components/SEO";

type GlobalRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  city: string | null;
  km_this_month: number;
  km_all_time: number;
  challenges_completed: number;
};
type ChallengeRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  km_logged: number;
  pct_complete: number;
  activity_mode: string;
  milestones_unlocked: number;
};
type FameRow = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  challenge_id: string;
  challenge_name: string;
  challenge_slug: string;
  unlocked_at: string;
};

const PAGE = 20;

const medalColor = (rank: number) =>
  rank === 1
    ? "text-amber-500"
    : rank === 2
    ? "text-zinc-400"
    : rank === 3
    ? "text-orange-700"
    : "";

const Leaderboard = () => {
  const [globalRows, setGlobalRows] = useState<GlobalRow[]>([]);
  const [globalPage, setGlobalPage] = useState(0);
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalHasMore, setGlobalHasMore] = useState(true);

  const [challenges, setChallenges] = useState<{ id: string; title: string }[]>([]);
  const [challengeId, setChallengeId] = useState<string>("");
  const [chRows, setChRows] = useState<ChallengeRow[]>([]);
  const [chPage, setChPage] = useState(0);
  const [chLoading, setChLoading] = useState(false);
  const [chHasMore, setChHasMore] = useState(true);

  const [fame, setFame] = useState<FameRow[]>([]);
  const [fameLoading, setFameLoading] = useState(true);


  // Global
  useEffect(() => {
    (async () => {
      setGlobalLoading(true);
      const { data, error } = await supabase.rpc("global_leaderboard", {
        _limit: PAGE,
        _offset: globalPage * PAGE,
      });
      if (!error) {
        const rows = (data ?? []) as GlobalRow[];
        setGlobalRows(rows);
        setGlobalHasMore(rows.length === PAGE);
      }
      setGlobalLoading(false);
    })();
  }, [globalPage]);

  // Challenges list once
  useEffect(() => {
    supabase
      .from("challenges")
      .select("id, name")
      .eq("status", true)
      .order("name")
      .then(({ data }) => {
        if (!data) return;
        setChallenges(data.map((c: any) => ({ id: c.id, title: c.name })));
      });
  }, []);

  // Challenge leaderboard
  useEffect(() => {
    if (!challengeId) {
      setChRows([]);
      return;
    }
    (async () => {
      setChLoading(true);
      const { data } = await supabase.rpc("challenge_leaderboard", {
        _challenge_id: challengeId,
        _limit: PAGE,
        _offset: chPage * PAGE,
      });
      const rows = (data ?? []) as ChallengeRow[];
      setChRows(rows);
      setChHasMore(rows.length === PAGE);
      setChLoading(false);
    })();
  }, [challengeId, chPage]);

  // Hall of fame
  useEffect(() => {
    (async () => {
      setFameLoading(true);
      const { data } = await supabase.rpc("hall_of_fame", { _limit: 60 });
      setFame((data ?? []) as FameRow[]);
      setFameLoading(false);
    })();
  }, []);

  return (
    <>
      <SEO
        title="Leaderboard | Atulya Bharat Run"
        description="See top runners, walkers and cyclists across India on the Atulya Bharat Run leaderboard."
        path="/leaderboard"
      />
      <section className="abr-container py-10">
        <h1 className="text-navy">Leaderboard</h1>
        <p className="mt-2 text-muted-foreground">See who's leading the pack across India.</p>

        <Tabs defaultValue="global" className="mt-8">
          <TabsList>
            <TabsTrigger value="global">Global</TabsTrigger>
            <TabsTrigger value="challenge">By Challenge</TabsTrigger>
            <TabsTrigger value="fame">Hall of Fame</TabsTrigger>
          </TabsList>

          {/* GLOBAL */}
          <TabsContent value="global" className="mt-6">
            <div className="relative overflow-x-auto rounded-2xl border border-border bg-card after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-card after:to-transparent md:after:hidden">
              <span className="sr-only">Scroll horizontally to see all columns.</span>
              {globalLoading ? (
                <Skeleton className="h-60 w-full" />
              ) : globalRows.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No activities logged yet.</p>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Athlete</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">KM this month</th>
                      <th className="px-4 py-3">All-time KM</th>
                      <th className="px-4 py-3">Completed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {globalRows.map((r, i) => {
                      const rank = globalPage * PAGE + i + 1;
                      return (
                        <tr key={r.user_id} className="border-t border-border">
                          <td className={`px-4 py-3 font-semibold ${medalColor(rank)}`}>
                            {rank <= 3 ? (
                              <span className="inline-flex items-center gap-1">
                                <Medal className="h-4 w-4" /> {rank}
                              </span>
                            ) : (
                              rank
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar url={r.avatar_url} name={r.full_name} size={32} />
                              <span className="font-medium text-foreground">
                                {r.full_name ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{r.city ?? "—"}</td>
                          <td className="px-4 py-3 font-semibold text-navy">
                            {Number(r.km_this_month).toFixed(1)}
                          </td>
                          <td className="px-4 py-3">{Number(r.km_all_time).toFixed(1)}</td>
                          <td className="px-4 py-3">{r.challenges_completed}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>Page {globalPage + 1}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={globalPage === 0}
                  onClick={() => setGlobalPage((p) => Math.max(0, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!globalHasMore}
                  onClick={() => setGlobalPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* BY CHALLENGE */}
          <TabsContent value="challenge" className="mt-6">
            <div className="max-w-sm">
              <Select
                value={challengeId}
                onValueChange={(v) => {
                  setChallengeId(v);
                  setChPage(0);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a challenge" />
                </SelectTrigger>
                <SelectContent>
                  {challenges.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative mt-5 overflow-x-auto rounded-2xl border border-border bg-card after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-card after:to-transparent md:after:hidden">
              <span className="sr-only">Scroll horizontally to see all columns.</span>
              {!challengeId ? (
                <p className="p-6 text-sm text-muted-foreground">Pick a challenge above.</p>
              ) : chLoading ? (
                <Skeleton className="h-60 w-full" />
              ) : chRows.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No registrations yet.</p>
              ) : (
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Athlete</th>
                      <th className="px-4 py-3">KM logged</th>
                      <th className="px-4 py-3">% complete</th>
                      <th className="px-4 py-3">Mode</th>
                      <th className="px-4 py-3">Milestones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chRows.map((r, i) => {
                      const rank = chPage * PAGE + i + 1;
                      return (
                        <tr key={r.user_id} className="border-t border-border">
                          <td className={`px-4 py-3 font-semibold ${medalColor(rank)}`}>
                            {rank <= 3 ? (
                              <span className="inline-flex items-center gap-1">
                                <Medal className="h-4 w-4" /> {rank}
                              </span>
                            ) : (
                              rank
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar url={r.avatar_url} name={r.full_name} size={32} />
                              <span className="font-medium text-foreground">
                                {r.full_name ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-semibold text-navy">
                            {Number(r.km_logged).toFixed(1)}
                          </td>
                          <td className="px-4 py-3">{Number(r.pct_complete).toFixed(1)}%</td>
                          <td className="px-4 py-3 capitalize text-muted-foreground">
                            {r.activity_mode}
                          </td>
                          <td className="px-4 py-3">{r.milestones_unlocked}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {challengeId && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>Page {chPage + 1}</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={chPage === 0}
                    onClick={() => setChPage((p) => Math.max(0, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!chHasMore}
                    onClick={() => setChPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* HALL OF FAME */}
          <TabsContent value="fame" className="mt-6">
            {fameLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-44 rounded-2xl" />
                ))}
              </div>
            ) : fame.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                <Trophy className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-display text-lg text-navy">No finishers yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Be the first to complete a challenge.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {fame.map((f) => (
                  <article
                    key={`${f.user_id}-${f.challenge_id}`}
                    className="rounded-2xl bg-card p-5 shadow-card"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar url={f.avatar_url} name={f.full_name} size={48} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">
                          {f.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(f.unlocked_at), "d MMM yyyy")}
                        </p>
                      </div>
                      <Medal className="h-7 w-7 text-amber-500" />
                    </div>
                    <p className="mt-4 font-display text-lg text-navy">{f.challenge_name}</p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <Button asChild variant="ghost" size="sm" className="mt-3 -ml-2">
                      <Link to={`/challenges/${f.challenge_slug}`}>View challenge →</Link>
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
};

export default Leaderboard;
