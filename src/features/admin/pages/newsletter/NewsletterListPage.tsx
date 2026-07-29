import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Download, Search, Trash2, UserCheck, UserX, Eye } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useDeleteSubscriber,
  useNewsletterStats,
  useNewsletterSubscribers,
  useSetSubscriberStatus,
} from "../../hooks/useAdminNewsletter";
import {
  downloadCsv,
  newsletterService,
  subscribersToCsv,
} from "@/services/newsletter.service";
import type { NewsletterSubscriber } from "@/types/newsletter";

const PAGE_SIZE = 10;

export default function NewsletterListPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "subscribed" | "unsubscribed">("all");
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [viewing, setViewing] = useState<NewsletterSubscriber | null>(null);

  const params = useMemo(
    () => ({ search, status, page, pageSize: PAGE_SIZE }),
    [search, status, page],
  );

  const { data, isLoading, error } = useNewsletterSubscribers(params);
  const stats = useNewsletterStats();
  const setStatusM = useSetSubscriberStatus();
  const delM = useDeleteSubscriber();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleExport(all: boolean) {
    try {
      const exportParams = all ? {} : { search, status };
      const rows = await newsletterService.exportAll(exportParams);
      if (!rows.length) {
        toast.message("No subscribers to export.");
        return;
      }
      const csv = subscribersToCsv(rows);
      const ts = new Date().toISOString().slice(0, 10);
      downloadCsv(`newsletter-subscribers-${all ? "all" : "filtered"}-${ts}.csv`, csv);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Newsletter</h1>
          <p className="text-sm text-muted-foreground">
            Manage subscribers and export reports.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleExport(false)}>
            <Download className="mr-2 h-4 w-4" /> Download CSV
          </Button>
          <Button onClick={() => handleExport(true)}>
            <Download className="mr-2 h-4 w-4" /> Download All
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Subscribers" value={stats.data?.total} />
        <StatCard label="Active Subscribers" value={stats.data?.active} />
        <StatCard label="Unsubscribed" value={stats.data?.unsubscribed} />
        <StatCard label="New (last 30 days)" value={stats.data?.last30Days} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by email"
            className="pl-8"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as typeof status);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="subscribed">Subscribed</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
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
              <TableHead>Email</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscribed</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-40 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No subscribers found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.email}</TableCell>
                  <TableCell className="text-muted-foreground">{r.source ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={r.status === "subscribed" ? "default" : "secondary"}
                      className="capitalize"
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(new Date(r.subscribed_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>{format(new Date(r.updated_at), "dd MMM yyyy")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="View"
                      onClick={() => setViewing(r)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {r.status === "subscribed" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Unsubscribe"
                        onClick={() =>
                          setStatusM.mutate(
                            { id: r.id, status: "unsubscribed" },
                            {
                              onSuccess: () => toast.success("Unsubscribed"),
                              onError: (e) => toast.error((e as Error).message),
                            },
                          )
                        }
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Resubscribe"
                        onClick={() =>
                          setStatusM.mutate(
                            { id: r.id, status: "subscribed" },
                            {
                              onSuccess: () => toast.success("Resubscribed"),
                              onError: (e) => toast.error((e as Error).message),
                            },
                          )
                        }
                      >
                        <UserCheck className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Delete"
                      onClick={() => setConfirmDelete(r.id)}
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

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this subscriber?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the email from your subscriber list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmDelete) return;
                delM.mutate(confirmDelete, {
                  onSuccess: () => {
                    toast.success("Subscriber deleted");
                    setConfirmDelete(null);
                  },
                  onError: (e) => toast.error((e as Error).message),
                });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Subscriber details</DialogTitle>
            <DialogDescription>Full record from the database.</DialogDescription>
          </DialogHeader>
          {viewing && (
            <dl className="grid grid-cols-3 gap-2 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="col-span-2 font-medium break-all">{viewing.email}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd className="col-span-2 capitalize">{viewing.status}</dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd className="col-span-2">{viewing.source ?? "—"}</dd>
              <dt className="text-muted-foreground">Subscribed</dt>
              <dd className="col-span-2">
                {format(new Date(viewing.subscribed_at), "dd MMM yyyy HH:mm")}
              </dd>
              <dt className="text-muted-foreground">Unsubscribed</dt>
              <dd className="col-span-2">
                {viewing.unsubscribed_at
                  ? format(new Date(viewing.unsubscribed_at), "dd MMM yyyy HH:mm")
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="col-span-2">
                {format(new Date(viewing.created_at), "dd MMM yyyy HH:mm")}
              </dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {value === undefined ? <Skeleton className="h-7 w-12" /> : value}
      </div>
    </div>
  );
}
