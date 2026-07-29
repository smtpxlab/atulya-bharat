import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Search, Send, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  useNotificationsAdmin,
  useDeleteNotification,
  useToggleNotificationPublished,
} from "../../hooks/useAdminNotifications";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const MESSAGE_TRUNCATE = 100;

function truncate(str: string, n: number) {
  if (!str) return "";
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

export default function NotificationListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const params = useMemo(
    () => ({ search, page, pageSize }),
    [search, page, pageSize],
  );
  const { data, isLoading, error } = useNotificationsAdmin(params);
  const del = useDeleteNotification();
  const togglePublish = useToggleNotificationPublished();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notification List</h1>
          <p className="text-sm text-muted-foreground">
            Manage global platform notifications.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/notifications/new">
            <Plus className="mr-2 h-4 w-4" /> New Notification
          </Link>
        </Button>
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
            placeholder="Search by title or message"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Show</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">entries</span>
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
              <TableHead className="w-16">S.No.</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Message</TableHead>
              <TableHead className="w-24">Status</TableHead>
              <TableHead className="w-20">Shared</TableHead>
              <TableHead className="w-44">Created</TableHead>
              <TableHead className="w-40 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No notifications yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((n, i) => (
                <TableRow key={n.id}>
                  <TableCell className="font-mono text-xs">
                    {(page - 1) * pageSize + i + 1}
                  </TableCell>
                  <TableCell className="font-medium">{n.title}</TableCell>
                  <TableCell className="max-w-md">
                    {n.message.length > MESSAGE_TRUNCATE ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-help">
                            {truncate(n.message, MESSAGE_TRUNCATE)}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm whitespace-pre-wrap">
                          {n.message}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      n.message
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={n.status ? "default" : "secondary"}>
                      {n.status ? "Enable" : "Disable"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{n.shared_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(n.created_at), "dd-MMM-yyyy hh:mm a")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        togglePublish.mutate(
                          { id: n.id, next: !n.is_published },
                          {
                            onSuccess: () =>
                              toast({
                                title: n.is_published
                                  ? "Notification unpublished"
                                  : "Notification published",
                              }),
                            onError: (e) =>
                              toast({
                                title: "Update failed",
                                description: (e as Error).message,
                                variant: "destructive",
                              }),
                          },
                        )
                      }
                      aria-label={n.is_published ? "Unpublish" : "Publish"}
                    >
                      {n.is_published ? (
                        <>
                          <EyeOff className="mr-1 h-4 w-4" /> Unpublish
                        </>
                      ) : (
                        <>
                          <Send className="mr-1 h-4 w-4" /> Publish
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/notifications/${n.id}/edit`)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(n.id)}
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
            <AlertDialogTitle>Delete this notification?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmId) return;
                del.mutate(confirmId, {
                  onSuccess: () => {
                    toast({ title: "Notification deleted" });
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
