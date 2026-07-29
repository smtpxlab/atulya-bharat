import { useNavigate, useParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { useTestimonial, useUpdateTestimonial } from "../../hooks/useAdminTestimonials";
import TestimonialForm from "./TestimonialForm";
import type { TestimonialFormData } from "@/types/testimonial";

export default function TestimonialEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useTestimonial(id);
  const update = useUpdateTestimonial(id ?? "");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Edit Testimonial</h1>
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
        <TestimonialForm
          submitLabel="Save"
          submitting={update.isPending}
          initial={{
            author_name: data.author_name,
            image_url: data.image_url,
            description: data.description,
            sort_order: data.sort_order,
          }}
          onSubmit={(values: TestimonialFormData) =>
            update.mutate(values, {
              onSuccess: () => {
                toast({ title: "Testimonial updated" });
                navigate("/admin/testimonials");
              },
              onError: (e) =>
                toast({
                  title: "Update failed",
                  description: (e as Error).message,
                  variant: "destructive",
                }),
            })
          }
          onCancel={() => navigate("/admin/testimonials")}
        />
      )}
    </div>
  );
}
