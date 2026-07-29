import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  useMilestones,
  useDeleteMilestone,
  useToggleMilestoneStatus,
} from "../../hooks/useAdminMilestones";

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const truncate = (s: string, n = 150) => (s.length > n ? `${s.slice(0, n)}…` : s);

const PAGE_SIZES = [10, 25, 50, 100];

export default function MilestoneListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data, isLoading, error } = useMilestones({ q, page, pageSize });
  const del = useDeleteMilestone();
  const toggle = useToggleMilestoneStatus();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Milestones</h1>
          <p className="text-sm text-muted-foreground">
            Spots unlocked as users progress through a challenge.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/challenges/milestones/create">
            <Plus className="mr-2 h-4 w-4" /> Add Milestone
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">entries</span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search spot or challenge"
            className="pl-8"
          />
        </div>
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
              <TableHead className="w-14">S.NO.</TableHead>
              <TableHead>Spot Name</TableHead>
              <TableHead>In Challenge</TableHead>
              <TableHead>Spot Image</TableHead>
              <TableHead>Distance (from start)</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-24 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={9}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                  No milestones yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((m, idx) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-xs">
                    {(page - 1) * pageSize + idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{m.spot_name}</TableCell>
                  <TableCell>{m.challenge?.name ?? "—"}</TableCell>
                  <TableCell>
                    {m.spot_image_url ? (
                      <img
                        src={m.spot_image_url}
                        alt={m.spot_name}
                        className="h-12 w-16 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{Number(m.distance)} km</TableCell>
                  <TableCell className="max-w-sm text-sm text-muted-foreground">
                    {truncate(stripHtml(m.description ?? ""), 150)}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={m.status}
                      onCheckedChange={(checked) =>
                        toggle.mutate(
                          { id: m.id, status: checked },
                          {
                            onError: (e) =>
                              toast({
                                title: "Update failed",
                                description: (e as Error).message,
                                variant: "destructive",
                              }),
                          },
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(m.created_at), "d MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        navigate(`/admin/challenges/milestones/${m.id}/edit`)
                      }
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(m.id)}
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
            <AlertDialogTitle>Delete this milestone?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the milestone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmId) return;
                del.mutate(confirmId, {
                  onSuccess: () => {
                    toast({ title: "Milestone deleted" });
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
