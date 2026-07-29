import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Eye,
  EyeOff,
  ImageOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  useAdminBlogs,
  useDeleteBlog,
  usePublishBlog,
  useUnpublishBlog,
} from "@/features/admin/hooks/useAdminBlogs";
import { useAppDispatch, useAppSelector } from "@/store";
import { setBlogFilter, type BlogStatusFilter } from "@/store/slices/adminSlice";

const fmt = (d: string | null) => (d ? format(new Date(d), "MMM d, yyyy") : "—");

export default function BlogListPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { q, status, page } = useAppSelector((s) => s.admin.blog);
  const pageSize = 10;

  const { data, isLoading, error } = useAdminBlogs({ q, status, page, pageSize });
  const del = useDeleteBlog();
  const publish = usePublishBlog();
  const unpublish = useUnpublishBlog();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const setQ = (v: string) => dispatch(setBlogFilter({ q: v, page: 1 }));
  const setStatus = (v: BlogStatusFilter) =>
    dispatch(setBlogFilter({ status: v, page: 1 }));
  const setPage = (updater: (p: number) => number) =>
    dispatch(setBlogFilter({ page: updater(page) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Blogs</h1>
          <p className="text-sm text-muted-foreground">
            Manage blog posts and SEO metadata.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/blog/new">
            <Plus className="mr-2 h-4 w-4" /> New post
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title or slug"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as BlogStatusFilter)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      <div className="rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">S.No.</TableHead>
              <TableHead className="w-20">Image</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-44 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  No posts yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((p, i) => (
                <TableRow key={p.id}>
                  <TableCell>{(page - 1) * pageSize + i + 1}</TableCell>
                  <TableCell>
                    {p.cover_image_url ? (
                      <img
                        src={p.cover_image_url}
                        alt=""
                        className="h-10 w-14 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-muted-foreground">
                        <ImageOff className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{p.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "published" ? "default" : "secondary"}>
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.author ?? "—"}</TableCell>
                  <TableCell>{fmt(p.published_at)}</TableCell>
                  <TableCell>{fmt(p.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/blog/${p.id}/edit`)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {p.status === "published" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={unpublish.isPending}
                        onClick={() =>
                          unpublish.mutate(p.id, {
                            onSuccess: () => toast({ title: "Unpublished" }),
                            onError: (e) =>
                              toast({
                                title: "Failed",
                                description: (e as Error).message,
                                variant: "destructive",
                              }),
                          })
                        }
                        aria-label="Unpublish"
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={publish.isPending}
                        onClick={() =>
                          publish.mutate(p.id, {
                            onSuccess: () => toast({ title: "Published" }),
                            onError: (e) =>
                              toast({
                                title: "Failed",
                                description: (e as Error).message,
                                variant: "destructive",
                              }),
                          })
                        }
                        aria-label="Publish"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(p.id)}
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="text-muted-foreground">
          {total} total · page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmId) return;
                del.mutate(confirmId, {
                  onSuccess: () => {
                    toast({ title: "Post deleted" });
                    setConfirmId(null);
                  },
                  onError: (e) =>
                    toast({
                      title: "Delete failed",
                      description: (e as Error).message,
                      variant: "destructive",
                    }),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
