import { useNavigate, useParams } from "react-router-dom";
import MilestoneForm from "./MilestoneForm";
import { useMilestone, useUpdateMilestone } from "../../hooks/useAdminMilestones";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function MilestoneEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useMilestone(id);
  const update = useUpdateMilestone(id);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error)
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Milestone</h1>
        <p className="text-sm text-muted-foreground">{data.spot_name}</p>
      </div>
      <MilestoneForm
        submitLabel="Save changes"
        submitting={update.isPending}
        lockChallenge
        initial={{
          challenge_id: data.challenge_id,
          spot_name: data.spot_name,
          distance: Number(data.distance),
          spot_image_url: data.spot_image_url,
          audio_url: data.audio_url,
          description: data.description,
          status: data.status,
        }}
        onSubmit={(values) =>
          update.mutate(values, {
            onSuccess: () => {
              toast({ title: "Milestone saved" });
              navigate("/admin/challenges/milestones");
            },
            onError: (e) =>
              toast({
                title: "Save failed",
                description: (e as Error).message,
                variant: "destructive",
              }),
          })
        }
      />
    </div>
  );
}
