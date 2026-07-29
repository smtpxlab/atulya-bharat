import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PaymentGateway, PaymentGatewayInput } from "../../services/paymentGateways.service";

const schema = z.object({
  payment_name: z
    .string()
    .trim()
    .min(2, "Payment name is required")
    .max(64)
    .regex(/^[a-z0-9_\-]+$/i, "Use letters, numbers, _ or - only"),
  title: z.string().trim().min(2, "Title is required").max(120),
  key_id: z.string().trim().min(4, "Razorpay Key ID is required").max(120),
  key_secret: z.string().max(255).optional().or(z.literal("")),
  is_active: z.boolean(),
  other_details: z.string().max(4000).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  initial?: PaymentGateway;
  submitting?: boolean;
  submitLabel: string;
  isEdit?: boolean;
  onSubmit: (values: PaymentGatewayInput) => void;
  onCancel: () => void;
};

export default function PaymentGatewayForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
  isEdit,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      payment_name: initial?.payment_name ?? "",
      title: initial?.title ?? "",
      key_id: initial?.key_id ?? "",
      key_secret: "",
      is_active: initial?.is_active ?? false,
      other_details: initial?.other_details
        ? JSON.stringify(initial.other_details, null, 2)
        : "",
    },
  });

  const handleSubmit = (values: FormValues) => {
    let other: Record<string, unknown> | null = null;
    if (values.other_details && values.other_details.trim().length > 0) {
      try {
        const parsed = JSON.parse(values.other_details);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          other = parsed as Record<string, unknown>;
        } else {
          other = { value: parsed } as Record<string, unknown>;
        }
      } catch {
        other = { notes: values.other_details };
      }
    }

    onSubmit({
      payment_name: values.payment_name,
      title: values.title,
      provider: "razorpay",
      key_id: values.key_id,
      key_secret: values.key_secret && values.key_secret.length > 0 ? values.key_secret : undefined,
      is_active: values.is_active,
      other_details: other,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="payment_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Payment Name</FormLabel>
                <FormControl>
                  <Input placeholder="razorpay_testmode" {...field} />
                </FormControl>
                <FormDescription>Unique internal identifier.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Razorpay Test" {...field} />
                </FormControl>
                <FormDescription>Display label.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="key_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Razorpay Key ID</FormLabel>
              <FormControl>
                <Input placeholder="rzp_test_xxxxxxxxxxxx" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="key_secret"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Razorpay Secret</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder={isEdit ? "Leave blank to keep existing secret" : "Razorpay Secret"}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Stored securely. Only used by backend functions — never exposed to the browser.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-md border p-4">
              <div>
                <FormLabel className="text-base">Status</FormLabel>
                <FormDescription>
                  {field.value ? "Enabled — used for checkout" : "Disabled"}
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="other_details"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Details (optional)</FormLabel>
              <FormControl>
                <Textarea
                  rows={5}
                  placeholder='Free-form notes or JSON, e.g. {"webhook_secret": "..."}'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Saved as JSON when valid; otherwise stored as a note.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}
