import { useNavigate } from "react-router-dom";
import PageForm from "./PageForm";
import { useCreatePage } from "@/features/admin/hooks/useAdminPages";
import { toast } from "@/hooks/use-toast";

export default function PageCreatePage() {
  const navigate = useNavigate();
  const create = useCreatePage();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New page</h1>
        <p className="text-sm text-muted-foreground">
          Create a static content page.
        </p>
      </div>
      <PageForm
        submitting={create.isPending}
        onCancel={() => navigate("/admin/pages")}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: () => {
              toast({ title: "Page created" });
              navigate("/admin/pages");
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
