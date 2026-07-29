import { useNavigate } from "react-router-dom";
import BlogForm from "./BlogForm";
import { useCreateBlog } from "@/features/admin/hooks/useAdminBlogs";
import { toast } from "@/hooks/use-toast";

export default function BlogCreatePage() {
  const navigate = useNavigate();
  const create = useCreateBlog();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New blog post</h1>
        <p className="text-sm text-muted-foreground">
          Create a draft or publish straight away.
        </p>
      </div>
      <BlogForm
        submitting={create.isPending}
        onCancel={() => navigate("/admin/blog")}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: () => {
              toast({
                title:
                  values.status === "published" ? "Post published" : "Draft saved",
              });
              navigate("/admin/blog");
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
