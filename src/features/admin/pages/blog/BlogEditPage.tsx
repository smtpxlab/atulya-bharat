import { useNavigate, useParams } from "react-router-dom";
import BlogForm from "./BlogForm";
import {
  useAdminBlog,
  useUpdateBlog,
} from "@/features/admin/hooks/useAdminBlogs";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export default function BlogEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useAdminBlog(id);
  const update = useUpdateBlog(id);

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error)
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  if (!data) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit blog post</h1>
        <p className="text-sm text-muted-foreground">{data.title}</p>
      </div>
      <BlogForm
        submitting={update.isPending}
        onCancel={() => navigate("/admin/blog")}
        initial={{
          title: data.title,
          slug: data.slug,
          excerpt: data.excerpt ?? "",
          content_html: data.content_html ?? data.content_md ?? "",
          cover_image_url: data.cover_image_url,
          author: data.author ?? "",
          tags: data.tags ?? [],
          status: data.status,
          meta_title: data.meta_title ?? "",
          meta_description: data.meta_description ?? "",
          meta_keywords: data.meta_keywords ?? [],
        }}
        onSubmit={(values) =>
          update.mutate(values, {
            onSuccess: () => {
              toast({ title: "Post saved" });
              navigate("/admin/blog");
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
