import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useFaq, useUpdateFaq } from "../../hooks/useAdminFaqs";
import FaqForm from "./FaqForm";
import type { FaqFormData } from "@/types/faq";

export default function FaqEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useFaq(id);
  const update = useUpdateFaq(id ?? "");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit FAQ</h1>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}
      {isLoading || !data ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <FaqForm
          submitLabel="Save"
          submitting={update.isPending}
          initial={{
            question: data.question,
            answer: data.answer,
            status: data.status,
            sort_order: data.sort_order,
          }}
          onSubmit={(values: FaqFormData) =>
            update.mutate(values, {
              onSuccess: () => {
                toast({ title: "FAQ updated" });
                navigate("/admin/faqs");
              },
              onError: (e) =>
                toast({
                  title: "Update failed",
                  description: (e as Error).message,
                  variant: "destructive",
                }),
            })
          }
          onCancel={() => navigate("/admin/faqs")}
        />
      )}
    </div>
  );
}
