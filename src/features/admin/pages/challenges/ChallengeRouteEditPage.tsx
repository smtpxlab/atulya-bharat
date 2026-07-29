import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminChallenge } from "@/features/admin/hooks/useAdminChallenges";
import { supabase } from "@/integrations/supabase/client";
import { RouteMapEditor, type EditorMilestone } from "./RouteMapEditor";

export default function ChallengeRouteEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useAdminChallenge(id);
  const [milestones, setMilestones] = useState<EditorMilestone[] | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const guardedBack = (e: React.MouseEvent) => {
    const confirmLeave = (window as any).__routeEditorConfirmLeave as
      | (() => boolean)
      | undefined;
    if (confirmLeave && !confirmLeave()) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    navigate("/admin/challenges");
  };

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("challenge_milestones")
        .select("id, spot_name, distance, x_percent, y_percent")
        .eq("challenge_id", id)
        .order("distance", { ascending: true });
      if (cancelled) return;
      setMilestones(
        (rows ?? []).map((r: any) => ({
          id: r.id,
          spot_name: r.spot_name ?? "",
          distance: Number(r.distance ?? 0),
          x_percent: r.x_percent != null ? Number(r.x_percent) : null,
          y_percent: r.y_percent != null ? Number(r.y_percent) : null,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  if (isLoading || milestones === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return <p className="text-destructive">Could not load challenge.</p>;
  }

  const { challenge } = data;

  return (
    <div className="space-y-4">
      <div>
        <Link
          to="/admin/challenges"
          onClick={guardedBack}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to challenges
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit Route — {challenge.name}</h1>
        <p className="text-sm text-muted-foreground">
          Drag each milestone pin onto its exact spot on the route map. Coordinates
          are saved as percentages so the layout stays accurate on every screen.
        </p>
      </div>

      {milestones.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No milestones exist for this challenge yet. Create milestones first,
          then return here to place them on the map.
        </div>
      ) : (
        <RouteMapEditor
          routeImageUrl={challenge.route_map_image_url}
          milestones={milestones}
          onSaved={() => setReloadKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
