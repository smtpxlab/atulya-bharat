import { useNavigate, useParams } from "react-router-dom";
import PageForm from "./PageForm";
import {
  useAdminPage,
  useUpdatePage,
} from "@/features/admin/hooks/useAdminPages";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function PageEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useAdminPage(id);
  const update = useUpdatePage(id!);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {(error as Error)?.message ?? "Page not found"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit page</h1>
        <p className="text-sm text-muted-foreground">{data.title}</p>
      </div>
      <PageForm
        submitting={update.isPending}
        initial={{
          title: data.title,
          slug: data.slug,
          content: data.content,
          status: data.status,
        }}
        onCancel={() => navigate("/admin/pages")}
        onSubmit={(values) =>
          update.mutate(values, {
            onSuccess: () => {
              toast({ title: "Page updated" });
              navigate("/admin/pages");
            },
            onError: (e) =>
              toast({
                title: "Update failed",
                description: (e as Error).message,
                variant: "destructive",
              }),
          })
        }
      />
    </div>
  );
}
