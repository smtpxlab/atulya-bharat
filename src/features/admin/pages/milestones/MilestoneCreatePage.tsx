import { useNavigate } from "react-router-dom";
import MilestoneForm from "./MilestoneForm";
import { useCreateMilestone } from "../../hooks/useAdminMilestones";
import { toast } from "@/hooks/use-toast";

export default function MilestoneCreatePage() {
  const navigate = useNavigate();
  const create = useCreateMilestone();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Milestone</h1>
      </div>
      <MilestoneForm
        submitLabel="Create milestone"
        submitting={create.isPending}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: () => {
              toast({ title: "Milestone created" });
              navigate("/admin/challenges/milestones");
            },
            onError: (e) =>
              toast({
                title: "Create failed",
                description: (e as Error).message,
                variant: "destructive",
              }),
          })
        }
      />
    </div>
  );
}
