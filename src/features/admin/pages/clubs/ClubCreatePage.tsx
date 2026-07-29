import { useNavigate } from "react-router-dom";
import ClubForm from "./ClubForm";
import { useCreateAdminClub } from "../../hooks/useAdminClubs";
import { toast } from "@/hooks/use-toast";

export default function ClubCreatePage() {
  const navigate = useNavigate();
  const create = useCreateAdminClub();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New club</h1>
        <p className="text-sm text-muted-foreground">
          Create a draft club. Publish from the detail page when ready.
        </p>
      </div>
      <ClubForm
        submitLabel="Create club"
        submitting={create.isPending}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: (data) => {
              toast({ title: "Club created" });
              navigate(`/admin/clubs/${data.id}`);
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
