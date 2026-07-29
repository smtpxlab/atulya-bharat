import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Eye, Search, Users, Check, X, EyeOff, FileText } from "lucide-react";
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
  useAdminClubs,
  useApproveClub,
  useDeleteAdminClub,
  useRejectClub,
  useToggleClubVisibility,
} from "../../hooks/useAdminClubs";
import { useAppDispatch, useAppSelector } from "@/store";
import { setClubFilter, ClubStatusFilter } from "@/store/slices/adminSlice";

type Status = ClubStatusFilter;

export default function ClubListPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { q, status, page } = useAppSelector((s) => s.admin.clubs);
  const pageSize = 20;
  const [visibility, setVisibility] = useState<"all" | "public" | "hidden">("all");

  const { data, isLoading, error } = useAdminClubs({ q, status, visibility, page, pageSize });
  const del = useDeleteAdminClub();
  const approve = useApproveClub();
  const reject = useRejectClub();
  const toggle = useToggleClubVisibility();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const setQ = (v: string) => dispatch(setClubFilter({ q: v, page: 1 }));
  const setStatus = (v: Status) => dispatch(setClubFilter({ status: v, page: 1 }));
  const setPage = (updater: (p: number) => number) =>
    dispatch(setClubFilter({ page: updater(page) }));

  const onErr = (e: unknown) =>
    toast({ title: "Action failed", description: (e as Error).message, variant: "destructive" });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clubs</h1>
          <p className="text-sm text-muted-foreground">Manage clubs, promoters and approvals.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/clubs/reports">
              <FileText className="mr-2 h-4 w-4" /> Reports
            </Link>
          </Button>
          <Button asChild>
            <Link to="/admin/clubs/new">
              <Plus className="mr-2 h-4 w-4" /> New club
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, slug, promoter…"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={visibility} onValueChange={(v) => setVisibility(v as any)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All visibility</SelectItem>
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Club</TableHead>
              <TableHead>Promoter</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Banner</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Visibility</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-48 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={12}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="py-10 text-center text-muted-foreground">
                  No clubs yet.
                </TableCell>
              </TableRow>
            ) : (
              items.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell>{(page - 1) * pageSize + i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground">/{c.slug}</div>
                    <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {c.member_count}
                    </div>
                  </TableCell>
                  <TableCell>{c.promoter_name ?? c.promoter?.full_name ?? "—"}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{c.promoter_email ?? "—"}</TableCell>
                  <TableCell>{c.promoter_phone ?? "—"}</TableCell>
                  <TableCell>
                    {c.banner_url ? (
                      <img src={c.banner_url} alt="" className="h-10 w-16 rounded object-cover" />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-[160px]">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        c.status === "approved"
                          ? "default"
                          : c.status === "rejected"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.is_public ? "Public" : "Hidden"}</Badge>
                  </TableCell>
                  <TableCell>{c.priority}</TableCell>
                  <TableCell className="text-xs">
                    {new Date(c.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Approve"
                      onClick={() => approve.mutate(c.id, { onError: onErr })}
                      disabled={c.status === "approved"}
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Reject"
                      onClick={() => reject.mutate(c.id, { onError: onErr })}
                      disabled={c.status === "rejected"}
                    >
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={c.is_public ? "Hide" : "Show"}
                      onClick={() =>
                        toggle.mutate({ id: c.id, is_public: !c.is_public }, { onError: onErr })
                      }
                    >
                      {c.is_public ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/clubs/${c.id}`)}
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/clubs/${c.id}/edit`)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(c.id)}
                      title="Delete"
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
            <AlertDialogTitle>Delete this club?</AlertDialogTitle>
            <AlertDialogDescription>
              This also removes its memberships. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmId) return;
                del.mutate(confirmId, {
                  onSuccess: () => {
                    toast({ title: "Club deleted" });
                    setConfirmId(null);
                  },
                  onError: onErr,
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
