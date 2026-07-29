import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import PaymentGatewayForm from "./PaymentGatewayForm";
import {
  createPaymentGateway,
  type PaymentGatewayInput,
} from "../../services/paymentGateways.service";

export default function PaymentGatewayCreatePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (input: PaymentGatewayInput) => createPaymentGateway(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "payment-gateways"] }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Payment Gateway</h1>
        <p className="text-sm text-muted-foreground">
          Configure a Razorpay gateway. Secret stays in the database.
        </p>
      </div>
      <PaymentGatewayForm
        submitLabel="Save"
        submitting={create.isPending}
        onSubmit={(values) =>
          create.mutate(values, {
            onSuccess: () => {
              toast({ title: "Gateway created" });
              navigate("/admin/payment-settings");
            },
            onError: (e) =>
              toast({
                title: "Create failed",
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
