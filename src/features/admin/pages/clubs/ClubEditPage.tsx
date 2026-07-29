import { useNavigate, useParams } from "react-router-dom";
import ClubForm from "./ClubForm";
import { useAdminClub, useUpdateAdminClub } from "../../hooks/useAdminClubs";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function ClubEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useAdminClub(id);
  const update = useUpdateAdminClub(id);

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
        <h1 className="text-2xl font-semibold tracking-tight">Edit club</h1>
        <p className="text-sm text-muted-foreground">{data.name}</p>
      </div>
      <ClubForm
        submitLabel="Save changes"
        submitting={update.isPending}
        initial={data as any}
        onSubmit={(values) =>
          update.mutate(values, {
            onSuccess: () => {
              toast({ title: "Club saved" });
              navigate(`/admin/clubs/${id}`);
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
