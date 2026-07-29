import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
  listPaymentGateways,
  setPaymentGatewayActive,
  deletePaymentGateway,
  maskKeyId,
  type PaymentGateway,
} from "../../services/paymentGateways.service";

const QK = ["admin", "payment-gateways"] as const;

export default function PaymentGatewayListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: QK,
    queryFn: listPaymentGateways,
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; next: boolean }) =>
      setPaymentGatewayActive(v.id, v.next),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePaymentGateway(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });

  const rows = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payment Gateways</h1>
          <p className="text-sm text-muted-foreground">
            Manage Razorpay credentials. Only one gateway can be active at a time.
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/payment-settings/new">
            <Plus className="mr-2 h-4 w-4" /> New gateway
          </Link>
        </Button>
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
              <TableHead>Payment Name</TableHead>
              <TableHead>Key ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-32 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  No payment gateways configured. Checkout will fall back to environment credentials.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((g: PaymentGateway, i) => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono text-xs">{i + 1}</TableCell>
                  <TableCell className="font-medium">{g.title}</TableCell>
                  <TableCell className="font-mono text-xs">{g.payment_name}</TableCell>
                  <TableCell className="font-mono text-xs">{maskKeyId(g.key_id)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={g.is_active}
                        onCheckedChange={(next) =>
                          toggle.mutate(
                            { id: g.id, next },
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
                      {g.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(g.updated_at), "dd MMM yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate(`/admin/payment-settings/${g.id}/edit`)}
                      aria-label="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmId(g.id)}
                      aria-label="Delete"
                      disabled={g.is_active}
                      title={g.is_active ? "Disable before deleting" : "Delete"}
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

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this gateway?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the gateway configuration. You can recreate it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmId) return;
                del.mutate(confirmId, {
                  onSuccess: () => {
                    toast({ title: "Gateway deleted" });
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
