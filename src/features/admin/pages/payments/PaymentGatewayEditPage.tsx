import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import PaymentGatewayForm from "./PaymentGatewayForm";
import {
  getPaymentGateway,
  updatePaymentGateway,
  type PaymentGatewayInput,
} from "../../services/paymentGateways.service";

export default function PaymentGatewayEditPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "payment-gateway", id],
    queryFn: () => getPaymentGateway(id),
    enabled: !!id,
  });

  const update = useMutation({
    mutationFn: (input: PaymentGatewayInput) => updatePaymentGateway(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "payment-gateways"] });
      qc.invalidateQueries({ queryKey: ["admin", "payment-gateway", id] });
    },
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (error)
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        {(error as Error).message}
      </div>
    );
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Payment Gateway</h1>
        <p className="text-sm text-muted-foreground">
          Leave the Secret field blank to keep the existing secret.
        </p>
      </div>
      <PaymentGatewayForm
        initial={data}
        isEdit
        submitLabel="Save changes"
        submitting={update.isPending}
        onSubmit={(values) =>
          update.mutate(values, {
            onSuccess: () => {
              toast({ title: "Gateway updated" });
              navigate("/admin/payment-settings");
            },
            onError: (e) =>
              toast({
                title: "Update failed",
                description: (e as Error).message,
                variant: "destructive",
              }),
          })
        }
        onCancel={() => navigate("/admin/payment-settings")}
      />
    </div>
  );
}
