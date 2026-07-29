import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useCreateFaq } from "../../hooks/useAdminFaqs";
import FaqForm from "./FaqForm";
import type { FaqFormData } from "@/types/faq";

export default function FaqCreatePage() {
  const navigate = useNavigate();
  const create = useCreateFaq();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New FAQ</h1>
        <p className="text-sm text-muted-foreground">Add a frequently asked question.</p>
      </div>
      <FaqForm
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={(values: FaqFormData) =>
          create.mutate(values, {
            onSuccess: () => {
              toast({ title: "FAQ created" });
              navigate("/admin/faqs");
            },
            onError: (e) =>
              toast({
                title: "Create failed",
                description: (e as Error).message,
                variant: "destructive",
              }),
          })
        }
        onCancel={() => navigate("/admin/faqs")}
      />
    </div>
  );
}
