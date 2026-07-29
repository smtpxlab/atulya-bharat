import { useMemo, useState } from "react";
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
  useCoupons,
  useDeleteCoupon,
  useToggleCouponStatus,
} from "../../hooks/useAdminCoupons";
import type { Coupon } from "@/types/coupon";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function formatCouponValue(c: Coupon): string {
  const v = Number(c.coupon_value).toFixed(2);
  return c.coupon_type === "percent" ? `${v}%` : `${v} Rs`;
}

function formatMoney(n: number | string): string {
  return `Rs. ${Number(n).toFixed(2)}`;
}

export default function CouponListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const params = useMemo(
    () => ({ search, page, pageSize }),
    [search, page, pageSize],
  );
  const { data, isLoading, error } = useCoupons(params);
  const del = useDeleteCoupon();
  const toggle = useToggleCouponStatus();

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Coupon List</h1>
          <p className="text-sm text-muted-foreground">
            Manage discount coupons.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/coupons/new">
            <Plus className="mr-2 h-4 w-4" /> New coupon
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
            placeholder="Search by coupon name"
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
              <TableHead>Coupon Name</TableHead>
              <TableHead>Coupon Value</TableHead>
              <TableHead>Min Order Amount</TableHead>
              <TableHead>Coupon Type</TableHead>
              <TableHead>Coupon Frequency</TableHead>
              <TableHead>Coupon Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="w-24 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={10}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="py-10 text-center text-muted-foreground"
                >
                  No coupons yet.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((c, i) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">
                    {(page - 1) * pageSize + i + 1}
                  </TableCell>
                  <TableCell className="font-medium">{c.coupon_name}</TableCell>
                  <TableCell>{formatCouponValue(c)}</TableCell>
                  <TableCell>{formatMoney(c.minimum_order_amount)}</TableCell>
                  <TableCell>
                    {c.coupon_type === "percent" ? "Percent" : "Fixed"}
                  </TableCell>
                  <TableCell>{c.coupon_frequency}</TableCell>
                  <TableCell>{c.coupon_used}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.status}
                        onCheckedChange={(next) =>
                          toggle.mutate(
                            { id: c.id, next },
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
                      <span className="text-xs">
                        {c.status ? "Enable" : "Disable"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {format(new Date(c.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/coupons/${c.id}/edit`)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(c.id)}
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

      <AlertDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this coupon?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the coupon.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmId) return;
                del.mutate(confirmId, {
                  onSuccess: () => {
                    toast({ title: "Coupon deleted" });
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
