import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useCreateTestimonial } from "../../hooks/useAdminTestimonials";
import TestimonialForm from "./TestimonialForm";
import type { TestimonialFormData } from "@/types/testimonial";

export default function TestimonialCreatePage() {
  const navigate = useNavigate();
  const create = useCreateTestimonial();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Testimonial</h1>
        <p className="text-sm text-muted-foreground">Add a public testimonial.</p>
      </div>
      <TestimonialForm
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={(values: TestimonialFormData) =>
          create.mutate(values, {
            onSuccess: () => {
              toast({ title: "Testimonial created" });
              navigate("/admin/testimonials");
            },
            onError: (e) =>
              toast({
                title: "Create failed",
                description: (e as Error).message,
                variant: "destructive",
              }),
          })
        }
        onCancel={() => navigate("/admin/testimonials")}
      />
    </div>
  );
}
